'use strict';

define(['angular-app'], function(app) {
    app.directive('content', function() {
        return {
            scope: {
                content: '@content',
                id:      '=contentId',
                result:  '=result'
            },
            link: function($scope) {
                var removeWatch = $scope.$watch('id', function(id) {
                    if (!id) {
                        return;
                    }
                    chrome.runtime.sendMessage({ msg: 'data', content: $scope.content, id: id }, function(result) {
                        $scope.$apply(function() {
                            $scope.result = result;
                        });
                    });
                    removeWatch();
                });
            }
        };
    });
});
