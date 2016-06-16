var routesService = require('./routes.service.js');

angular.module('routes-service', []).service('RoutesService', routesService);

var app = angular.module('routes-module', [
    'routes-service'
]);

module.exports = app;