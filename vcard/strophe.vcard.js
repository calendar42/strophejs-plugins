/* 
Plugin to implement the vCard extension. 
http://xmpp.org/extensions/xep-0054.html

Author: Nathan Zorn (nathan.zorn@gmail.com)

*/
/* jslint configuration: */
/* global document, window, setTimeout, clearTimeout, console,
    XMLHttpRequest, ActiveXObject,
    Base64, MD5,
    Strophe, $build, $msg, $iq, $pres 
*/
var buildIq = function(type, from, jid, vCardEl) {
    var iq, _jid,
        _from = Strophe.getBareJidFromJid(from);
        
    if (!jid)
    {
        //retrieve current jid's vCard
        iq = $iq({type:type, from:_from});
    }
    else
    {
        _jid = Strophe.getBareJidFromJid(jid);
        iq = $iq({type:type, to:_jid, from:_from});
    }
    // var ret = iq.c("vCard", {xmlns:Strophe.NS.VCARD});
    if (vCardEl)
    {
        iq = iq.cnode(vCardEl);
    }
    else
    {
        iq.c("vCard", {xmlns:Strophe.NS.VCARD});
    }
    return iq;
};
Strophe.addConnectionPlugin('vcard', {
    _connection: null,
    // Called by Strophe.Connection constructor
    init: function(conn) {
        this._connection = conn;
        Strophe.addNamespace('VCARD', 'vcard-temp');
        Strophe.addNamespace('SEARCH', 'jabber:iq:search');
        Strophe.addNamespace('DATA', 'jabber:x:data');
    },
    /****Function
      Retrieve a vCard for a JID/Entity
      Parameters:
      (Function) handler_cb - The callback function used to handle the request.
      (String) jid - optional - The name of the entity to request the vCard
         If no jid is given, this function retrieves the current user's vcard.
    */
    get: function(jid, success, error, timeout) {
        var that = this._connection;
        var iq = buildIq("get", this._connection.jid, jid);
        return that.sendIQ(iq.tree(), success, error, timeout);
    },
    /*** Function
        Set an entity's vCard.
    */
    set: function(jid, vCardEl, success, error, timeout) {
        var that = this._connection;
        var iq = buildIq("set", this._connection.jid, jid, vCardEl);
        that.sendIQ(iq.tree(), success, error, timeout);
    },
        /** Function: vcards
    *
    * Parameters:
    *    (object) fields -  The fields to search on.
    *    'user', 'fn', 'first', 'middle', 'last', 'nick', 'bday', 'ctry', 'locality', 'email', 'orgname', 'orgunit'
    *    (Function) succes - Called on callback.
    *    (Function) error - Called on error server response.
    *
    *  Returns:
    *    Iq id
     */

    search: function (fields, vcardDir, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("vcardSearch");

        var iq = $iq({from:that.jid, to:vcardDir, type:'set', id:_iqid})
            .c('query', {'xmlns': Strophe.NS.SEARCH})
            .c('x', {'xmlns':Strophe.NS.DATA, type:'submit'});
            for (var key in fields)
            {
                if (fields.hasOwnProperty(key))
                {
                    var value = fields[key];
                      iq.c('field', {'var':key}).c('value').t(value);
                }
            }
        return that.sendIQ(iq.tree(), success, error, timeout);
    }
});