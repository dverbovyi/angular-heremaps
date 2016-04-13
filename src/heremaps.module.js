(function () {
    'use strict';

    var directive = require('./heremaps.directive'),
        configProvider = require('./common/config.provider'),
        apiService = require('./common/api.service'),
        utilsService = require('./common/utils.service'),
        consts = require('./common/consts');

    angular.module('heremaps', [])
        .provider('Config', configProvider)
        .service('APIService', apiService)
        .service('UtilsService', utilsService)
        .constant('CONSTS', consts)
        .config(["ConfigProvider", function (ConfigProvider) {
            ConfigProvider.setOptions({
                'app_id': 'wMHJuLgCQzkfbhzXIwRF',
                'app_code': 'WLIc7QzoO8irv7lurUt1qA'
            });
        }])
        .directive('hereMaps', directive);
})();