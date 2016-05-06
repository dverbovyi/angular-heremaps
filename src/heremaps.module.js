require('./providers/markers/markers.module');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/config.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/utils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module'
]);

//TODO: Please rename services to avoid name collizions
heremaps
    .provider('Config', configProvider)
    .service('APIService', ['$q', 'Config', 'UtilsService', 'CONSTS', apiService])
    .service('UtilsService', utilsService)
    .constant('CONSTS', consts)
    .directive('heremaps', directive);

//TODO: app_id and app_code should be configurable inside app, not inside plugin
//Maybe ConfigProvider.appId = '..' or ConfigProvider.setCredentials({..}) or ConfigProvider.setAppId('..') ?
//Also would be nice if app_code can be getted from function like 'app_code': (MYCONST) => MYCONST.PRODUCTION?'WLIc7QzoO8irv7lurUt1qA':'TEST';
heremaps.config(["ConfigProvider", function(ConfigProvider) {
    ConfigProvider.setOptions({
        'apiVersion': '3.0',
        'app_id': 'wMHJuLgCQzkfbhzXIwRF',
        'app_code': 'WLIc7QzoO8irv7lurUt1qA',
        'useHTTPS': true
    });
}]);

module.exports = heremaps;
