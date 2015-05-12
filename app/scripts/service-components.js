var angular = require('angular');

module.exports = angular.module(chrome.i18n.getMessage('app_short_name') + 'ServiceComponents', [])
    .factory('apiService', ['$q', function($q) {
        function call_background(params, deferred, object) {
            chrome.runtime.sendMessage(params, function(response) {
                if (!response) {
                    return deferred.reject();
                }
                if (response[0]) {
                    return deferred.reject(response[0]);
                }
                angular.extend(object, response[1]);
                return deferred.resolve(response[1]);
            });
        }

        return { get: function(params, success, failure) {
            var deferred = $q.defer();
            var object = {
                $resolved: false,
                $promise: deferred.promise
                    .then(success, failure)
                    .finally(function() {
                        object.$resolved = true;
                    })
            };

            call_background(params, deferred, object);

            return object;
        } };
    }])
    .name;
