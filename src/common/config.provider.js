module.exports = function() {
    var options = {};

    this.$get = function(){
        return {
            app_id: options.app_id,
            app_code: options.app_code
        }
    };

    this.setOptions = function(opts){
        options = opts;
    };
};