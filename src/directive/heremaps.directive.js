/**
 * Created by Dmytro on 4/11/2016.
 */
var tpl = require('./heremaps.tpl.html');

module.exports = function(HereMaps){
  return {
      restrict: 'EA',
      template: tpl,
      controller: function($scope, $element){
          console.log(HereMaps);
      },
      link: function(scope){}
  }
};