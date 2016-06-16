var markerInterface = require('./marker.js'),
	defaultMarker = require('./default.marker.js'),
	domMarker = require('./dom.marker.js'),
	svgMarker = require('./svg.marker.js'),
    markersService = require('./markers.service.js');

angular.module('marker-interface', []).factory('MarkerInterface', markerInterface);
angular.module('default-marker', []).factory('DefaultMarker', defaultMarker);
angular.module('dom-marker', []).factory('DOMMarker', domMarker);
angular.module('svg-marker', []).factory('SVGMarker', svgMarker);

angular.module('markers-service', []).service('MarkersService', markersService);

var app = angular.module('markers-module', [
	'marker-interface',
    'default-marker',
    'dom-marker',
    'markers-service',
    'svg-marker'
]);

module.exports = app;