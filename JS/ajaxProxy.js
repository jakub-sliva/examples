/**
 * Overrides Backbone.ajax according to configuration. Should increase appl response in some cases.
 *
 * @class     AjaxProxy
 * @classdesc A proxy class for all backbone's requests, allows grouping of requests by transactions.
 * @author    Jakub Sliva <j.sliva@seznam.cz>
 * @category  Example
 * 
 */
define([
    'backbone',
    'underscore',
    'core/multiRequest',
    'core/utils'
], function (Backbone, _, MultiRequestModel, Utils) {
    // define parent object for ajax proxy API methods
    var AjaxProxy;

    // config and local storages for each features
    var FEATURE = {
        ajaxWithPriority: {
            enabled      : true,
            timeout      : 3001,
            lowPrioBuffer: [],
            lowPrioTimer : undefined
        },

        multiRequest: {
            enabled     : (window.IW.enableMultiRequest !== false ? true : false), // needed in jsunit tests
            transactions: {}, // open transactions
            dynamic: {
                enabled: false,
                timeout: 101, // because it's nice number
                tid    : undefined
            }
        },

        // NOTE: NOT FINISHED, now all GET/POST/PUT/DELELE are cached, so it doesn't work correctly, see #31018
        requestCache: {
            enabled  : false,
            timeout  : 2001,
            responses: {}
        }
    };

    // keeps original Backbone ajax handler
    var backboneAjax = Backbone.ajax;

    /**
     * Executes buffered low priority xhrs.
     *
     * @return {void}
     */
    function _runLowPrioRequests () {
        var
            options;

        while (FEATURE.ajaxWithPriority.lowPrioBuffer.length) {
            options = FEATURE.ajaxWithPriority.lowPrioBuffer.shift();
            backboneAjax(options);
        }
    }

    /**
     * Store data to cache
     *
     * @param {String} identifier request url
     * @param {Object} data       response data
     * @param {Object} xhr        request to process
     *
     * @return {void}
     */
    function _saveToCache (identifier, data, xhr) {
        // functionality must be enabled
        if (FEATURE.requestCache.enabled === false) {
            return;
        }

        // save data to cache
        FEATURE.requestCache.responses[identifier] = {
            data: data,
            xhr : xhr,
            time: new Date()
        };
    }

    /**
     * Get data from cache.
     * If record exists in cache -> use it and remove request from transaction
     *
     * @param {Object} xhr request to process
     * @param {String} tid transaction ID
     * @param {String} rid request ID
     *
     * @return {void}
     */
    function _getFromCache (xhr, tid, rid) {
        // functionality must be enabled
        if (FEATURE.requestCache.enabled === false) {
            return;
        }

        var url   = xhr.options.url,
            cache = FEATURE.requestCache.responses;

        // url must exists in cache
        if (_.isObject(cache) && cache.hasOwnProperty(url) && !_.isEmpty(cache[url].data)) {
            // time of cached data must not be expired
            if ((new Date() - cache[url].time) <= FEATURE.requestCache.timeout) {
                // return request as success
                xhr.options.success(cache[url].data, 'success', cache[url].xhr);

                // delete request form transaction
                if (FEATURE.multiRequest.transactions[tid] && FEATURE.multiRequest.transactions[tid][rid]) {
                    delete FEATURE.multiRequest.transactions[tid][rid];
                }
            } else {
                // time is expired -> delete url from chache
                delete cache[url];
            }
        }
    }

    /**
     * Create new fake XHR proxy request
     *
     * @param {Object} options options of original request
     *
     * @return {XMLHttpRequest} fake request
     */
    function _createProxyRequest (options) {
        var xhr     = {};
        xhr.options = options;
        xhr.abort   = function () {
            var tid = this.options.tid, rid = this.options.rid;
            if (FEATURE.multiRequest.transactions[tid] && FEATURE.multiRequest.transactions[tid][rid]) {
                delete FEATURE.multiRequest.transactions[tid][rid];
            }
        };

        return xhr;
    }

    /**
     * Adds request into transaction buffer
     *
     * @param {Object} options request's options
     *
     * @return {XMLHttpRequest} a fake XHR object
     */
    function _addTrasactionRequest (options) {
        options.rid = _.uniqueId('r');
        FEATURE.multiRequest.transactions[options.tid][options.rid] = _createProxyRequest(options);
        return FEATURE.multiRequest.transactions[options.tid][options.rid];
    }

    /**
     * Close a transaction
     *
     * @param {String} tid transaction ID
     *
     * @return {void}
     */
    function _closeTransaction (tid) {
        if (FEATURE.multiRequest.transactions[tid]) {
            delete FEATURE.multiRequest.transactions[tid];
        }
    }

    /**
     * Completes a request (call success or error)
     *
     * @param {String}  tid     transaction ID
     * @param {String}  rid     request ID
     * @param {Object}  data    response data
     * @param {Boolean} success is successful request or not?
     *
     * @return {void}
     */
    function _completeRequest (tid, rid, data, success) {
        if (FEATURE.multiRequest.transactions[tid] && FEATURE.multiRequest.transactions[tid][rid]) {
            var xhr = FEATURE.multiRequest.transactions[tid][rid];

            if (success) {
                if (xhr.options.success) {
                    xhr.options.success(data, 'success', xhr);
                    _saveToCache(xhr.options.url, data, xhr);
                }
            } else {
                if (xhr.options.error) {
                    xhr.readyState   = 4;
                    xhr.status       = data.code;
                    xhr.statusText   = data.status;
                    xhr.responseJSON = data;
                    xhr.options.error(xhr, 'error', data.status);
                }
            }
        }
    }

    /**
     * Callback for bundle request
     *
     * @param {jqXHR}  jqXHR       a XHR object of the request
     * @param {String} textStatus  textual representation of status
     * @param {String} errorThrown text with error message
     *
     * @return {void}
     */
    function _handleError (jqXHR, textStatus, errorThrown) {
        if (FEATURE.multiRequest.transactions[jqXHR.tid]) {
            _.each(FEATURE.multiRequest.transactions[jqXHR.tid], function (xhr, rid) {
                _completeRequest(jqXHR.tid, rid, {code: jqXHR.status, status: errorThrown}, false);
            });
        }

        _closeTransaction(jqXHR.tid);
    }

    /**
     * Callback for bundle request
     *
     * @param {Object} data       response data
     * @param {String} textStatus textual representation of status
     * @param {jqXHR}  jqXHR      a XHR object of the request
     *
     * @return {void}
     */
    function _handleSuccess (data, textStatus, jqXHR) {
        if (typeof data == 'string') {
            try {
                data = Backbone.$.parseJSON(data); //old IE returns JSON string instead object
            } catch (e) {
                _handleError(jqXHR, 'parse error', e.toString());
            }
        }

        if (data && data.responses) {
            _.each(data.responses, function (response, rid) {
                // not all responses are not be successful
                var success = (!_.isObject(response) || response.status !== 'failed');

                _completeRequest(jqXHR.tid, rid, response, success);
            });
        }

        _closeTransaction(jqXHR.tid);
    }

    /**
     * Callback for single request.
     * Return function which process original code and close trannsaction.
     *
     * @param {Object} originalFunction Original function which must be called after handle response
     * @param {String} url              Requested url
     *
     * @return {object}
     */
    function _handleSingleRequestResponse (originalFunction, url) {
        var handler;

        handler = function (data, textStatus, jqXHR) {
            originalFunction.apply(this, arguments);
            _saveToCache(url, data, jqXHR);
            _closeTransaction(jqXHR.tid);
        };

        return handler;
    }

    /**
     * Wraps all transaction request into one and ask rest api
     *
     * @param {Object} xhrs requests to process
     * @param {String} tid  transaction ID
     *
     * @return {jqXHR} XHR of bundle request
     */
    function _executeRequests (xhrs, tid) {
        var options,
            jqXHR,
            requests = {};

        // handle empty requests
        if (_.isEmpty(xhrs)) {
            return;
        }

        // use cache functionality
        _.each(xhrs, function (xhr, rid) {
            _getFromCache(xhr, tid, rid);
        });

        // handle empty requests - again
        if (_.isEmpty(xhrs)) {
            return;
        }

        if (_.keys(xhrs).length === 1) {
            // in transaction is only one request -> not use mutli request functionality
            options         = _.first(_.values(xhrs)).options;
            options.success = _handleSingleRequestResponse(options.success, options.url);
            options.error   = _handleSingleRequestResponse(options.error, options.url);
        } else {
            // more requests in one transaction -> use multi request functionality
            _.each(xhrs, function (xhr, rid) {
                requests[rid] = _.pick(xhr.options, 'url', 'type', 'data');
                if (typeof requests[rid].data == 'string') {
                    requests[rid].data = Backbone.$.parseJSON(requests[rid].data); //prevent double encodeq
                }
            });

            options = {
                type   : 'POST',
                url    : (new MultiRequestModel()).url(),
                data   : Utils.stringify({requests: requests}),
                success: _handleSuccess,
                error  : _handleError,
                cache  : false,
                contentType: 'application/json'
            };
        }

        jqXHR     = backboneAjax(options);
        jqXHR.tid = tid;

        return jqXHR;
    }

    /**
     * Verify that given options are part of open transaction
     *
     * @param {Object} options request's options
     *
     * @return {Boolean}
     */
    function _isTransactionRequest (options) {
        if (
            // is request from some open transaction
            options.tid && FEATURE.multiRequest.transactions[options.tid]
            // is async (therefore we'll wait forever)
                && options.async !== false
        ) {
            return true;
        }

        return false;
    }

    /**
     * Create dynamic transaction if not exists and add request.
     *
     * @param  {Object} options request's options
     *
     * @return {void}
     */
    function _useDynamicTransaction (options) {
        if (FEATURE.multiRequest.dynamic.tid === undefined) {
            FEATURE.multiRequest.dynamic.tid = AjaxProxy.beginTransaction();

            setTimeout(function () {
                AjaxProxy.commitTransaction(FEATURE.multiRequest.dynamic.tid);
                FEATURE.multiRequest.dynamic.tid = undefined;
            }, FEATURE.multiRequest.dynamic.timeout);
        }

        options.tid =  FEATURE.multiRequest.dynamic.tid;
        AjaxProxy.ajax(options);
    }

    /**
     * Public API methods.
     *
     */
    AjaxProxy = {

        /**
         * Proxy ajax handler, it returns normal request or fake one if request is hold in transaction
         *
         * @param  {Object} options request's options
         *
         * @return {XMLHttpRequest}
         */
        ajax: function (options) {
            // request is in transaction yet
            if (_isTransactionRequest(options)) {
                return _addTrasactionRequest(options);
            }

            // request is not member of transaction and can be used as asynchronous
            if (FEATURE.multiRequest.dynamic.enabled && (options.async !== false)) {
                return _useDynamicTransaction(options);
            }

            // is not a trans, call with priority, but only if enabled
            if (FEATURE.ajaxWithPriority.enabled) {
                return AjaxProxy.ajaxWithPriority(options);
            }

            return backboneAjax(options);
        },

        /**
         * Start a transaction
         *
         * @return {String} transaction ID
         */
        beginTransaction: function () {
            var tid = _.uniqueId('t');
            FEATURE.multiRequest.transactions[tid] = {};

            return tid;
        },

        /**
         * Commit given transaction
         *
         * @param {String} tid transaction ID
         *
         * @return {jqXHR} XHR of bundle request
         */
        commitTransaction: function (tid) {
            var
                callback,
                allHaveLowPriority = true;

            if (FEATURE.multiRequest.transactions[tid]) {
                if (FEATURE.ajaxWithPriority.enabled) {
                    // delay all if some xhr inside has low priority
                    _.each(FEATURE.multiRequest.transactions[tid], function (xhr) {
                        allHaveLowPriority = allHaveLowPriority && xhr.options.lowPriority;
                    });
                } else {
                    allHaveLowPriority = false; // no feature, no low priority
                }

                callback = function () {
                    _executeRequests(FEATURE.multiRequest.transactions[tid], tid);
                };

                if (allHaveLowPriority) {
                    setTimeout(callback, FEATURE.ajaxWithPriority.timeout); // delay
                } else {
                    callback(); // run immediatelly
                }
            }
        },

        /**
         * Executes normal xhr immediately and postpones low prio xhr by some time.
         * NOTE: low prio xhr cannot be aborted because this method returns no xhr object in this case
         *
         * @param {object} options Option params for jQuery ajax function.
         *
         * @return {jqXHR|void} jQuery XHR object or nothing for low prio xhr
         */
        ajaxWithPriority: function (options) {
            var
                xhr;

            // xhr with normal priority => postpone low prio and run normal immediatelly
            if (options.lowPriority !== true) {
                clearTimeout(FEATURE.ajaxWithPriority.lowPrioTimer);
                FEATURE.ajaxWithPriority.lowPrioTimer = undefined;

                xhr = backboneAjax(options);

            // just add low prio into buffer to postpone it
            } else {
                FEATURE.ajaxWithPriority.lowPrioBuffer.push(options);
            }

            // plan low prio requests to be executed later in defined delay
            if (FEATURE.ajaxWithPriority.lowPrioTimer === undefined) {
                FEATURE.ajaxWithPriority.lowPrioTimer = setTimeout(function () {
                    _runLowPrioRequests();
                    FEATURE.ajaxWithPriority.lowPrioTimer = undefined;
                }, FEATURE.ajaxWithPriority.timeout);
            }

            return xhr;
        }
    };

    if (FEATURE.multiRequest.enabled) {
        // override standard backbone ajax handler
        if (Backbone.ajax !== AjaxProxy.ajax) {
            Backbone.ajax = AjaxProxy.ajax; // Backbone will call our ajax proxy
        }
    } else if (FEATURE.ajaxWithPriority.enabled) {
        // override standard backbone ajax handler
        if (Backbone.ajax !== AjaxProxy.ajax) {
            Backbone.ajax = AjaxProxy.ajaxWithPriority; // Backbone will call our ajax prio proxy
        }
    }

    return AjaxProxy;
});
