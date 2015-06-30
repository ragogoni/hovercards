var _       = require('underscore');
var angular = require('angular');

module.exports = angular.module(chrome.i18n.getMessage('app_short_name') + 'PeopleComponents', [require('./service-components')])
    .controller('PeopleController', ['$scope', '$interval', '$timeout', '$window', 'apiService', function($scope, $interval, $timeout, $window, apiService) {
        var others_exist_watcher = $scope.$watch('entry.type', function(type) {
            if (!type) {
                return;
            }
            others_exist_watcher();
            if (type === 'account') {
                $scope.entry.can_have_people = true;
                return;
            }

            /* check to see if all the things we want to load are out of our way. Also, give them time to animate or whatever */
            var other_things_loaded_watcher = $scope.$watch('data.content.$resolved && data.discussion.$resolved', function(other_things_loaded) {
                if (!other_things_loaded) {
                    return;
                }
                other_things_loaded_watcher();

                $timeout(function() {
                    angular.element($window).scroll();

                    var interval = $interval(function() {
                        angular.element($window).scroll();
                    }, 100);

                    /* Check to see if we hit the bottom once we've waited for everything and forced a scroll */
                    var can_have_people_watcher = $scope.$watch('view.at.people', function(value) {
                        if (!value) {
                            return;
                        }
                        $interval.cancel(interval);
                        can_have_people_watcher();
                        if ($window.innerHeight <= angular.element('.people-card-space').offset().top) {
                            chrome.runtime.sendMessage({ type: 'analytics', request: ['send', 'event', 'people', 'scrolled to'] });
                            $scope.entry.people_needed_scrolling = true;
                        }

                        $scope.entry.can_have_people = true;
                    });
                }, 300);
            });
        });

        function request_to_string(request) {
            return [request.api, request.type, request.id, request.as].join('/');
        }

        function request_sort_value(request) {
            var pos = _.indexOf(['author', 'tag', 'mention'], request.reason);
            if (pos === -1) {
                pos = Infinity;
            }
            return pos;
        }

        var analytics_once = false;
        $scope.$watchCollection('entry.can_have_people && entry.accounts', function(requests) {
            if (!_.result(requests, 'length')) {
                $scope.data.accounts = null;
                $scope.data.people = null;
                return;
            }

            var parts = (function reload(accounts, people) {
                var timeout = $timeout(function() {
                    people.$err = { 'still-waiting': true };
                }, 5000);
                requests = _.chain(requests)
                            .sortBy(request_sort_value)
                            .uniq(false, request_to_string)
                            .value();
                _.each(requests, function load_account_into(request) {
                    var key = request_to_string(request);
                    if (accounts[key] && (!accounts[key].$err || !accounts[key].$err.unauthorized)) {
                        return;
                    }
                    accounts[key] = _.extend(apiService.get(request), _.pick(request, 'reason'));
                    accounts[key].$promise
                        .finally(function() {
                            $timeout.cancel(timeout);
                        })
                        .then(function(account) {
                            if (analytics_once) {
                                return account;
                            }
                            analytics_once = true;
                            if ($scope.entry.times) {
                            var now = _.now();
                                chrome.runtime.sendMessage({ type: 'analytics', request: ['send', 'timing', 'cards', 'Time until First Account Card (' + ($scope.entry.people_needed_scrolling ? 'Needed Scrolling' : 'Didn\'t need Scrolling') + ')', now - $scope.entry.times.start, account.api + ' account'] });
                                if (!$scope.entry.times.first_card) {
                                    $scope.entry.times.first_card = now;
                                    chrome.runtime.sendMessage({ type: 'analytics', request: ['send', 'timing', 'cards', 'Time until First Card', $scope.entry.times.first_card - $scope.entry.times.start, account.api + ' account'] });
                                }
                            }
                            return account;
                        })
                        .then(function(account) {
                            delete people.$err;
                            var account_ids = _.chain(account.connected)
                                               .map(request_to_string)
                                               .push(key)
                                               .uniq()
                                               .value();
                            var person = _.chain(people)
                                          .filter(function(person) {
                                              return _.intersection(person.account_ids, account_ids).length;
                                          })
                                          .reduce(function(person, person_to_merge) {
                                              person.accounts    = _.union(person.accounts,    person_to_merge.accounts);
                                              person.account_ids = _.union(person.account_ids, person_to_merge.account_ids);
                                              person.position    = _.min([person.position,     person_to_merge.position]);
                                              people.splice(_.indexOf(people, person_to_merge), 1);
                                              return person;
                                          })
                                          .value();
                            if (!person) {
                                person = { accounts: [], account_ids: [], position: Infinity };
                                people.push(person);
                            }
                            var position_in_entry = _.indexOf(requests, request);
                            position_in_entry = (position_in_entry === -1) ? Infinity : position_in_entry;

                            person.accounts        = _.chain(person.accounts).union([account]).sortBy(request_sort_value).value();
                            person.account_ids     = _.chain(person.account_ids).union(account_ids).uniq().value();
                            person.position        = _.min([person.position, position_in_entry]);
                            person.selectedAccount = person.selectedAccount || account;
                            people.sort(function(a, b) {
                                return a.position - b.position;
                            });
                            _.each(account.connected, load_account_into);
                            return account;
                        })
                        .catch(function(err) {
                            if (people.length) {
                                return;
                            }
                            people.$err = err;
                            people.$err.reload = function() {
                                reload(accounts, people);
                            };
                        });
                });

                return [accounts, people];
            }($scope.data.accounts || {}, $scope.data.people || []));

            $scope.data.accounts = parts[0];
            $scope.data.people   = parts[1];
        });
    }])
    .directive('peopleCarousel', ['$compile', function($compile) {
        require('slick-carousel');

        return {
            link: function($scope, $element) {
                $element.slick({ arrows: false, centerMode: true, centerPadding: 0, focusOnSelect: true, infinite: false, slidesToShow: 1 });
                $element.on('beforeChange', function(event, slick, current, next) {
                    $scope.$apply(function() {
                        $scope.entry.selectedPerson = $scope.data.people[next];
                        $scope.view.fullscreen = null;
                    });
                });
                $element.one('beforeChange', function() {
                    chrome.runtime.sendMessage({ type: 'analytics', request: ['send', 'event', 'people', 'changed'] });
                });
                $scope.$watchCollection('data.people', function(people, oldPeople) {
                    _.times(oldPeople && people !== oldPeople && oldPeople.length, function() {
                        $element.slick('slickRemove', 0);
                    });
                    _.each(people, function(person) {
                        var element = '<div style="height: 157px;"><div ng-include="\'templates/\' + person.selectedAccount.api + \'_account.html\'"></div></div>';
                        $element.slick('slickAdd', $compile(element)(_.extend($scope.$new(), { person: person })));
                    });
                    $scope.entry.selectedPerson = (people && people[$element.slick('slickCurrentSlide') || 0]) || null;
                });
            }
        };
    }])
    .controller('AccountShimController', ['$scope', 'apiService', function($scope, apiService) {
        var doIt = $scope.$watch('inview && person_to_load', function(request) {
            if (!request) {
                return;
            }
            $scope.person = { selectedAccount: apiService.get(request) };
            doIt();
        });
    }])
    .name;