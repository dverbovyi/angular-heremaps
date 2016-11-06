module.exports = HereMapsSVGMarker;

HereMapsSVGMarker.$inject = ['HereMapsMarkerInterface'];
function HereMapsSVGMarker(HereMapsMarkerInterface){
    function SVGMarker(place){
        this.place = place;
        this.setCoords();
    }
    
    var proto = SVGMarker.prototype = new HereMapsMarkerInterface();
    proto.constructor = SVGMarker;
    
    proto.create = create;
    proto.getIcon = getIcon;
    
    return SVGMarker;
    
    function create(){
        var marker = new H.map.Marker(this.coords, {
            icon: this.getIcon(),
        });
        
        this.addInfoBubble(marker);
        
        return marker;
    }
    
    function getIcon(){
        var icon = this.place.markup;
         if(!icon)
            throw new Error('markup missed');

        return new H.map.Icon(icon);
    }
}