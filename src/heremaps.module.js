require('./providers/markers/markers.module');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/mapconfig.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/utils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module'
]);

heremaps
    .provider('MapConfig', configProvider)
    .service('APIService', ['$q', 'MapConfig', 'UtilsService', 'CONSTS', apiService])
    .service('UtilsService', utilsService)
    .constant('CONSTS', consts);

heremaps.directive('heremaps', directive);

module.exports = heremaps;