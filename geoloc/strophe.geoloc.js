/*
 * This plugin is distributed under the terms of the MIT licence.
 * Please see the LICENCE file for details.
 */

/**
 * File: strophe.geoloc.js
 * A Strophe plugin for XMPP User Location ( http://xmpp.org/extensions/xep-0080.html )
 */

Strophe.addConnectionPlugin('geoloc', {
	_c: null,

	// called by the Strophe.Connection constructor
	init: function(conn)
	{
		this._c = conn;
		Strophe.addNamespace('GEOLOC', "http://jabber.org/protocol/geoloc");
	},

	/**
	 * Function: publishGeoloc
	 *
     * Parameters:
     *    (String) node       - The name of the pubsub node.
     *    (String) to         - The jid you want to send the iq to.
     *    (String) accuracy   - The jid you want to send the iq to.
     *    (String) lat        - The jid you want to send the iq to.
     *    (String) lon        - The jid you want to send the iq to.
     *    (String) locality   - The jid you want to send the iq to.
     *    (String) country    - The jid you want to send the iq to.
     *    (Function) success  - callback function for successful node creation.
     *    (Function) error    - error callback function.
     *    (Number) timeout    - Timeout in ms.
     *    (String) iqid         - Iq id.
	 */
	publishGeoloc: function(node, to, accuracy, lat, lon, locality, country, success, error, timeout, iqid)
	{
        var _iqid = iqid ? iqid : this._c.getUniqueId('publishgeoloc');
		var iq = $iq({type: 'set', to: to, id: _iqid}).
            c('pubsub', { xmlns:Strophe.NS.PUBSUB }).
                c('publish', { xmlns: Strophe.NS.GEOLOC, node: node }).
                    c('item').
                        c('geoloc');
        if (accuracy) {
            iq.c('accuracy').t(accuracy).up();
        }
        if (lat) {
            iq.c('lat').t(lat).up();
        }
        if (lon) {
            iq.c('lon').t(lon).up();
        }
        if (locality) {
            iq.c('locality').t(locality).up();
        }
        if (country) {
            iq.c('country').t(country).up();
        }
        
		return this._c.sendIQ(iq.tree(), success, error, timeout);
	}
});
