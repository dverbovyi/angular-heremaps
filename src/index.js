require('./providers/markers/markers.module');
require('./providers/components/components.module');

var directive = require('./heremaps.directive'),
    configProvider = require('./providers/mapconfig.provider'),
    apiService = require('./providers/api.service'),
    utilsService = require('./providers/maputils.service'),
    consts = require('./providers/consts');

var heremaps = angular.module('heremaps', [
    'markers-module',
    'components-module'
]);

heremaps
    .provider('HereMapsConfig', configProvider)
    .service('APIService', ['$q', 'HereMapsConfig', 'HereMapUtilsService', 'CONSTS', apiService])
    .service('HereMapUtilsService', utilsService)
    .constant('CONSTS', consts);

heremaps.directive('heremaps', directive);

module.exports = heremaps;