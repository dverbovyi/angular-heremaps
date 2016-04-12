(function () {
    'use strict';

    var directive = require('./directive/heremaps.directive'),
        apiProvider = require('./api.provider');

    angular.module('app', [])
        .factory('APIProvider', apiProvider)
        .run(function (APIProvider) {
            APIProvider.setConfig({
                'app_id': 'wMHJuLgCQzkfbhzXIwRF',
                'app_code': 'WLIc7QzoO8irv7lurUt1qA'
            });
        })
        .directive('hereMaps', directive);
})();