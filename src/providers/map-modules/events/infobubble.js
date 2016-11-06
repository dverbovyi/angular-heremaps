module.exports = HereMapsInfoBubbleFactory;

HereMapsInfoBubbleFactory.$inject = [
    'HereMapsMarkerService',
    'HereMapsUtilsService',
    'HereMapsCONSTS'
];
function HereMapsInfoBubbleFactory(HereMapsMarkerService, HereMapsUtilsService, HereMapsCONSTS) {
    function InfoBubble() {}

    var proto = InfoBubble.prototype;
        
    proto.create = create;
    proto.update = update;
    proto.toggle = toggle;
    proto.show = show;
    proto.close = close;

    return {
        create: function(){
            return new InfoBubble();
        }
    }

    function toggle(e, ui) {
        if (HereMapsMarkerService.isMarkerInstance(e.target))
            this.show(e, ui);
        else
            this.close(e, ui);
    }

    function update(bubble, data) {
        bubble.display = data.display;

        bubble.setPosition(data.position);
        bubble.setContent(data.markup);

        bubble.setState(HereMapsCONSTS.INFOBUBBLE.STATE.OPEN);
    }

    function create(source) {
        var bubble = new H.ui.InfoBubble(source.position, {
            content: source.markup
        });

        bubble.display = source.display;
        bubble.addClass(HereMapsCONSTS.INFOBUBBLE.STATE.OPEN)

        HereMapsUtilsService.addEventListener(bubble, 'statechange', function(e) {
            var state = this.getState(),
                el = this.getElement();
            if (state === HereMapsCONSTS.INFOBUBBLE.STATE.CLOSED) {
                el.classList.remove(HereMapsCONSTS.INFOBUBBLE.STATE.OPEN);
            } else
                this.addClass(state)
        });

        return bubble;
    }

    function show(e, ui, data) {
        var target = e.target,
            data = target.getData(),
            el = null;

        if (!data || !data.display || !data.markup || data.display !== HereMapsCONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type])
            return;

        var source = {
            position: target.getPosition(),
            markup: data.markup,
            display: data.display
        };

        if (!ui.bubble) {
            ui.bubble = this.create(source);
            ui.addBubble(ui.bubble);

            return;
        }

        this.update(ui.bubble, source);
    }

    function close(e, ui) {
        if (!ui.bubble || ui.bubble.display !== HereMapsCONSTS.INFOBUBBLE.DISPLAY_EVENT[e.type]) {
            return;
        }

        ui.bubble.setState(HereMapsCONSTS.INFOBUBBLE.STATE.CLOSED);
    }
}