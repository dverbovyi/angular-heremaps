/**
 * Created by Dmytro on 4/11/2016.
 */

describe('Here Maps directive', function () {
    var scope, $compile, $rootScope, $timeout,
        template = angular.element('<div heremaps></div>');
        

    beforeEach(function(){
        angular.mock.module('heremaps');
        
        inject(function (_$compile_, _$rootScope_, _$timeout_) {
            $compile = _$compile_;
            $timeout = _$timeout_;
            $rootScope = _$rootScope_;
            $scope = $rootScope.$new();
        })

    });

    it('Should compile a directive', function () {
        var result = $compile(template)($scope);
        $timeout.flush();
        $scope.$digest();
        expect(result[0].outerHTML).toBe('<div ng-style=\"{\'width\': mapWidth, \'height\': mapHeight}\" heremaps="" class="ng-scope ng-isolate-scope" style="width: 640px; height: 480px;\"></div>');
    });
});
