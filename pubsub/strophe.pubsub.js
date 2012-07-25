/*
    This program is distributed under the terms of the MIT license.
    Please see the LICENSE file for details.

    Copyright 2008, Stanziq  Inc.

    Overhauled in October 2009 by Liam Breck [How does this affect copyright?]
*/

/** File: strophe.pubsub.js
 *  A Strophe plugin for XMPP Publish-Subscribe.
 *
 *  Provides Strophe.Connection.pubsub object,
 *  parially implementing XEP 0060.
 *
 *  Strophe.Builder.prototype methods should probably move to strophe.js
 */

/** Function: Strophe.Builder.form
 *  Add an options form child element.
 *
 *  Does not change the current element.
 *
 *  Parameters:
 *    (String) ns - form namespace.
 *    (Object) options - form properties.
 *
 *  Returns:
 *    The Strophe.Builder object.
 */
Strophe.Builder.prototype.form = function (ns, options)
{
    var aX = this.node.appendChild(Strophe.xmlElement('x', {"xmlns": "jabber:x:data", "type": "submit"}));
    aX.appendChild(Strophe.xmlElement('field', {"var":"FORM_TYPE", "type": "hidden"}))
      .appendChild(Strophe.xmlElement('value'))
      .appendChild(Strophe.xmlTextNode(ns));

    for (var i in options) {
        aX.appendChild(Strophe.xmlElement('field', {"var": i}))
        .appendChild(Strophe.xmlElement('value'))
        .appendChild(Strophe.xmlTextNode(options[i]));
    }
    return this;
};

/** Function: Strophe.Builder.list
 *  Add many child elements.
 *
 *  Does not change the current element.
 *
 *  Parameters:
 *    (String) tag - tag name for children.
 *    (Array) array - list of objects with format:
 *          { attrs: { [string]:[string], ... }, // attributes of each tag element
 *             data: [string | XML_element] }    // contents of each tag element
 *
 *  Returns:
 *    The Strophe.Builder object.
 */
Strophe.Builder.prototype.list = function (tag, array)
{
    for (var i=0; i < array.length; ++i) {
        this.c(tag, array[i].attrs);
        this.node.appendChild(array[i].data.cloneNode
                            ? array[i].data.cloneNode(true)
                            : Strophe.xmlTextNode(array[i].data));
        this.up();
    }
    return this;
};

Strophe.Builder.prototype.children = function (object) {
    var key, value;
    for (key in object) {
        if (!object.hasOwnProperty(key)) {
            continue;
        }
        value = object[key];
        if (Array.isArray(value)) {
            this.list(key, value);
        } else if (typeof value === 'string') {
            this.c(key, {}, value);
        } else if (typeof value === 'number') {
            this.c(key, {}, ""+value);
        } else if (typeof value === 'object') {
            this.c(key).children(value).up();
        } else {
            this.c(key).up();
        }
    }
    return this;
};

// TODO Ideas Adding possible conf values?
/* Extend Strophe.Connection to have member 'pubsub'.
 */

var pubsub = {
// Strophe.addConnectionPlugin('pubsub', {
/*
Extend connection object to have plugin name 'pubsub'.
*/
    _connection: null,
    _autoService: true,
    service: null,
    jid: null,

    //The plugin must have the init function.
    init: function(conn) {
        this._connection = conn;

        /*
        Function used to setup plugin.
        */

        /* extend name space
        *  NS.PUBSUB - XMPP Publish Subscribe namespace
        *              from XEP 60.
        *
        *  NS.PUBSUB_SUBSCRIBE_OPTIONS - XMPP pubsub
        *                                options namespace from XEP 60.
        */
        Strophe.addNamespace('PUBSUB',"http://jabber.org/protocol/pubsub");
        Strophe.addNamespace('PUBSUB_SUBSCRIBE_OPTIONS',
                             Strophe.NS.PUBSUB+"#subscribe_options");
        Strophe.addNamespace('PUBSUB_ERRORS',Strophe.NS.PUBSUB+"#errors");
        Strophe.addNamespace('PUBSUB_EVENT',Strophe.NS.PUBSUB+"#event");
        Strophe.addNamespace('PUBSUB_OWNER',Strophe.NS.PUBSUB+"#owner");
        Strophe.addNamespace('PUBSUB_AUTO_CREATE',
                             Strophe.NS.PUBSUB+"#auto-create");
        Strophe.addNamespace('PUBSUB_PUBLISH_OPTIONS',
                             Strophe.NS.PUBSUB+"#publish-options");
        Strophe.addNamespace('PUBSUB_NODE_CONFIG',
                             Strophe.NS.PUBSUB+"#node_config");
        Strophe.addNamespace('PUBSUB_CREATE_AND_CONFIGURE',
                             Strophe.NS.PUBSUB+"#create-and-configure");
        Strophe.addNamespace('PUBSUB_SUBSCRIBE_AUTHORIZATION',
                             Strophe.NS.PUBSUB+"#subscribe_authorization");
        Strophe.addNamespace('PUBSUB_GET_PENDING',
                             Strophe.NS.PUBSUB+"#get-pending");
        Strophe.addNamespace('PUBSUB_MANAGE_SUBSCRIPTIONS',
                             Strophe.NS.PUBSUB+"#manage-subscriptions");
        Strophe.addNamespace('PUBSUB_META_DATA',
                             Strophe.NS.PUBSUB+"#meta-data");
        Strophe.addNamespace('ATOM', "http://www.w3.org/2005/Atom");

        if (conn.disco) {
            conn.disco.addFeature(Strophe.NS.PUBSUB);
        }

    },

    // Called by Strophe on connection event
    statusChanged: function (status, condition) {
        var that = this._connection;
        if (this._autoService && status === Strophe.Status.CONNECTED) {
            this.service =  'pubsub.'+Strophe.getDomainFromJid(that.jid);
            this.jid = that.jid;
        }
    },

    /***Function
    *
    * Parameters:
    *    (String) jid - The node owner's jid.
    *    (String) service - The name of the pubsub service.
    */
    connect: function (jid, service) {
        var that = this._connection;
        if (service === undefined) {
            service = jid;
            jid = undefined;
        }
        this.jid = jid || that.jid;
        this.service = service || null;
        this._autoService = false;
    },

    /***Function
    *
    * Create a pubsub node on the given service with the given node name.
    *
    * Parameters:
    *    (String) node -  The name of the pubsub node.
    *    (Dictionary) options -  The configuration options for the  node.
    *    (Function) success - Called on success server response.
    *    (Function) error - Called on error server response.
    *    (Number) timeout - Called on error server response.
    *    (String) iqid - Optional used as iq-id
    *
    * Returns:
    *    Iq id used to send subscription.
    */
    createNode: function(node, options, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubcreatenode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB})
          .c('create',{node:node});
        if(options) {
            iq.up().c('configure').form(Strophe.NS.PUBSUB_NODE_CONFIG, options);
        }

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /***Function
    *
    * Configure a pubsub node on the given service with the given node name.
    *
    * Parameters:
    *    (String) node -  The name of the pubsub node.
    *    (Dictionary) options -  The configuration options for the  node.
    *    (Function) success - Called on success server response.
    *    (Function) error - Called on error server response.
    *    (Number) timeout - Called on error server response.
    *    (String) iqid - Optional used as iq-id
    *
    * Returns:
    *    Iq id used to send subscription.
    */
    configureNode: function(node, options, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubcreatenode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB_OWNER})
          .c('configure',{node:node});
        if(options) {
            iq.form(Strophe.NS.PUBSUB_NODE_CONFIG, options);
        }

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },


    /** Function: deleteNode
     *  Delete a pubsub node.
     *
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    deleteNode: function(node, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubdeletenode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB_OWNER})
          .c('delete', {node:node});

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /** Function
     *
     * Get all nodes that currently exist.
     *
     * Parameters:
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
     discoverNodes: function(node, success, error, timeout, iqid) {
         var that = this._connection;
         var _iqid = iqid ? iqid : that.getUniqueId("pubsubdisconode");

         var iq = $iq({from:this.jid, to:this.service, type:'get', id: _iqid });

         if (node) {
             iq.c('query', { xmlns:Strophe.NS.DISCO_ITEMS, node:node });
         } else {
             //ask for all nodes
             iq.c('query', { xmlns:Strophe.NS.DISCO_ITEMS });
         }

         return this._connection.sendIQ(iq.tree(), success, error, timeout);
     },

    /** Function: getConfig
     *  Get node configuration form.
     *
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    getConfig: function (node, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubconfigurenode");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:_iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB_OWNER})
          .c('configure', {node:node});

        return this._connection.sendIQ(iq.tree(),success, error, timeout);
    },

    /**
     *  Parameters:
     *    (Function) call_back - Receives subscriptions.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  8.3 Request Default Node Configuration Options
     *
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    getDefaultNodeConfig: function(success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubdefaultnodeconfig");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:_iqid})
          .c('pubsub', {'xmlns':Strophe.NS.PUBSUB_OWNER})
          .c('default');

        return this._connection.sendIQ(iq.tree(),success, error, timeout);
    },

    /***Function
    *    Subscribe to a node in order to receive event items.
    *
    * Parameters:
    *    (String) node         - The name of the pubsub node.
    *    (Array) options       - The configuration options for the  node.
    *    (Function) event_cb   - Used to recieve subscription events.
    *    (Function) success - Called on success server response.
    *    (Function) error - Called on error server response.
    *    (Number) timeout - Called on error server response.
    *    (String) iqid - Optional used as iq-id
    *    (Boolean) barejid     - use barejid creation was sucessful.
    *
    * Returns:
    *    Iq id
    */
    subscribe: function(node, options, event_cb, success, error, timeout, iqid, barejid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubsubscribenode");

        var jid = this.jid;
        if(barejid) {
            jid = Strophe.getBareJidFromJid(jid);
        }

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('subscribe', {'node':node, 'jid':jid});
        if(options) {
            iq.up().c('options').form(Strophe.NS.PUBSUB_SUBSCRIBE_OPTIONS, options);
        }

        //add the event handler to receive items
        if (event_cb && typeof event_cb === 'function') {
            that.addHandler(event_cb, null, 'message', null, null, null);
        }

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /***Function
    *   Unsubscribe from a node.
    *
    * Parameters:
    *    (String) node       - The name of the pubsub node.
    *    (String) jid        - The jid you want to unsubscribe.
    *    (String) subid      - Subscription id.
    *    (Function) success  - callback function for successful node creation.
    *    (Function) error    - error callback function.
    *    (Number) timeout    - Timeout in ms.
    *    (String) iqid         - Iq id.

    */
    unsubscribe: function(node, jid, subid, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubunsubscribenode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('unsubscribe', {'node':node, 'jid':jid});
        if (subid) {
            iq.attrs({subid:subid});
        }

        return that.sendIQ(iq.tree(), success, error, timeout);
    },

    /***Function
    *   retract from a node or item.
    *
    * Parameters:
    *    (String) node       - The name of the pubsub node.
    *    (Function) success  - callback function for successful node creation.
    *    (Function) error    - error callback function.
    *    (Number) timeout    - Timeout in ms.
    *    (String) iqid         - Iq id.

    */
    retract: function(node, id, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubunsubscribenode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('retract', {'node':node})
          .c('item', {'id':id});

        return that.sendIQ(iq.tree(), success, error, timeout);
    },

    /***Function
    *
    * Publish and item to the given pubsub node.
    *
    * Parameters:
    *    (String) node -  The name of the pubsub node.
    *    (Array) items -  The list of items to be published.
    *    (Function) success - Called on success server response.
    *    (Function) error - Called on error server response.
    *    (Number) timeout - Called on error server response.
    *    (String) iqid - Optional used as iq-id
    *
    *  Returns:
    *    Iq id
    */
    publish: function(node, items, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubpublishnode");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('publish', { node:node, jid:this.jid })
          .list('item', items);

        return that.sendIQ(iq.tree(), success, error, timeout);
    },

    /*Function: items
    * Used to retrieve the persistent items from the pubsub node.
    *
    * Parameters:
    *    (String) node -  The name of the pubsub node.
    *    (Function) success - Called on success server response.
    *    (Function) error - Called on error server response.
    *    (Number) timeout - Called on error server response.
    *    (String) iqid - Optional used as iq-id
    *
    *  Returns:
    *    Iq id
    */
    items: function(node, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubitems");

        //ask for all items
        var iq = $iq({from:this.jid, to:this.service, type:'get', id:_iqid})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('items', {node:node});

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /*Function: item
    Used to retrieve a specific persistent item from a pubsub node.

    */
    item: function(node, id, success, error, timeout) {
        //ask for specific item
        var iq = $iq({from:this.jid, to:this.service, type:'get'})
          .c('pubsub', { xmlns:Strophe.NS.PUBSUB })
          .c('items', {node:node})
          .c('item', {id:id});

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /** Function: getSubscriptions
     *  Get subscriptions of a JID.
     *
     *  Parameters:
     *    (Function) call_back - Receives subscriptions.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  5.6 Retrieve Subscriptions
     *
     * Parameters:
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    getSubscriptions: function(node, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubsubscriptions");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:_iqid})
          .c('pubsub', {'xmlns':Strophe.NS.PUBSUB_OWNER})
          .c('subscriptions', {'node': node});

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /** Function: getNodeSubscriptions
     *  Get node subscriptions of a JID.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  5.6 Retrieve Subscriptions
     *
     * Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    getNodeSubscriptions: function(node, success, error, timeout, iqid, options) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubsubscriptions");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:_iqid})
         .c('pubsub', {'xmlns':Strophe.NS.PUBSUB_OWNER})
         .c('subscriptions', {'node':node}).up();

         if (options) {
          iq.c('set', {'xmlns': 'http://jabber.org/protocol/rsm' });
          for (var key in options) {
            if (options.hasOwnProperty(key)) {
              iq.c(key).t(options[key]).up();
            }
          }
         }

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /** Function: setNodeSubscriptions
     *  Set node subscriptions for provided list.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  8.8.2 Modify Subscriptions
     *
     * Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Array) subscriptions -  List of objects with jid and subscription
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    setNodeSubscriptions: function(node, subscriptions, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubsubscriptions");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
         .c('pubsub', {'xmlns':Strophe.NS.PUBSUB_OWNER})
         .c('subscriptions', {'node':node });

         for (var i = 0; i < subscriptions.length; i++) {
          iq.c('subscription', {'jid': subscriptions[i].jid, 'subscription': subscriptions[i].subscription}).up();
         }


        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },
    /** Function: getSubOptions
     *  Get subscription options form.
     *
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (String) subid - The subscription id (optional).
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    getSubOptions: function(node, subid, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubsuboptions");

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:_iqid})
          .c('pubsub', {xmlns:Strophe.NS.PUBSUB})
          .c('options', {node:node, jid:this.jid});
        if (subid) {
            iq.attrs({subid:subid});
        }

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /**
     *  Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) call_back - Receives subscriptions.
     *
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  8.9 Manage Affiliations - 8.9.1.1 Request
     *
     * Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    getAffiliations: function(node, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubaffiliations");

        if (typeof node === 'function') {
            call_back = node;
            node = undefined;
        }

        var attrs = {}, xmlns = {'xmlns':Strophe.NS.PUBSUB};
        if (node) {
            attrs.node = node;
            xmlns = {'xmlns':Strophe.NS.PUBSUB_OWNER};
        }

        var iq = $iq({from:this.jid, to:this.service, type:'get', id:_iqid})
          .c('pubsub', xmlns).c('affiliations', attrs);

        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /**
     *  http://xmpp.org/extensions/tmp/xep-0060-1.13.html
     *  8.9.2 Modify Affiliation - 8.9.2.1 Request
     *
     * Parameters:
     *    (String) node -  The name of the pubsub node.
     *    (String) jid -  Jid for the affiliation.
     *    (String) affiliation -  affiliation.
     *    (Function) success - Called on success server response.
     *    (Function) error - Called on error server response.
     *    (Number) timeout - Called on error server response.
     *    (String) iqid - Optional used as iq-id
     *
     *  Returns:
     *    Iq id
     */
    setAffiliation: function(node, jid, affiliation, success, error, timeout, iqid) {
        var that = this._connection;
        var _iqid = iqid ? iqid : that.getUniqueId("pubsubaffiliations");

        var iq = $iq({from:this.jid, to:this.service, type:'set', id:_iqid})
          .c('pubsub', {'xmlns':Strophe.NS.PUBSUB_OWNER})
          .c('affiliations', {'node':node})
          .c('affiliation', {'jid':jid, 'affiliation':affiliation});
        return this._connection.sendIQ(iq.tree(), success, error, timeout);
    },

    /** Function: publishAtom
    *
    * Parameters:
    *    (String) node -  The name of the pubsub node.
    *    (Array) atoms -  Jid for the affiliation.
    *    (Function) callback - Called on callback.
    *
    *  Returns:
    *    Iq id
     */
    publishAtom: function(node, atoms, call_back) {
        if (!Array.isArray(atoms)) {
            atoms = [atoms];
        }

        var i, atom, entries = [];
        for (i = 0; i < atoms.length; i++) {
            atom = atoms[i];

            atom.updated = atom.updated || (new Date()).toISOString();
            if (atom.published && atom.published.toISOString) {
                atom.published = atom.published.toISOString();
            }

            entries.push({
                data: $build("entry", { xmlns:Strophe.NS.ATOM }).children(atom).tree(),
                attrs:(atom.id ? { id:atom.id } : {})
            });
        }
        return this.publish(node, entries, call_back);
    }
};

var Strophe = Strophe || {};
Strophe.pubsub = function () {};
Strophe.pubsub.prototype = pubsub;
