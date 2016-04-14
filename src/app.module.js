
require('./heremaps/heremaps.module');

var controller = require('./app.controller')

var app = angular.module('app', [
    "heremaps"
]);

app.controller('AppCtrl', controller);

module.exports = app;
    

