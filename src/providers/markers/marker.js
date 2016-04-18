module.exports = function(){
    function Marker(){
        throw new Error('Abstract class! The Instance should be created');
    }
    
    var proto = Marker.prototype;
    
    proto.create = function(){ throw new Error('getInstance:: not implemented'); };
    
    proto.setCoords = function(){
        this.coords = {
            lat: this.place.pos.lat,
            lng: this.place.pos.lng
        }
    }
    
    return Marker;
    
}