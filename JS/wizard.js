/**
 * Ui.Wizard view class.
 *
 * @author    Jakub Sliva <j.sliva@seznam.cz>
 * @category  Example
 *
 */
define([
    'core/views/container',
    'core/views/tabs',
    'core/views/ui/headline',
    'core/views/ui/button',
    'core/views/ui/linkButton',
    'core/browser'
], function (
    ContainerView,
    TabsView,
    HeadlineView,
    ButtonView,
    LinkButtonView,
    Browser
) {
    var ParentClass = TabsView;

    /**
     * @class     Wizard
     * @classdesc Complex visual component for displaying a tabbed wizard
     * with automatical Prev/Next/Submit/Cancel buttons.
     * It significantly extends Ui.Tabs by paging functionality and  by automatic submitting values like Ui.Form.
     * If validation rules are set then user can switch to prev or next tab only if types valid inputs.
     *
     * @extends   Tabs
     *
     * @param {Array} tabs - Configuration for tabs to be displayed. List of {header, selector} pairs for each tab.
     * @param {String} tabs.header - Text displayed as tab header (title).
     * @param {String} tabs.selector - Tab content subview selector.
     * @param {String} text - Wizard caption text shown at the top of all tabs
     *
     */

    /**
     * Reserved for Ui.Tabs usage only.
     *
     * @event Wizard.tab:selected
     */

    /**
     * Reserved for Ui.Tabs usage only.
     *
     * @event Wizard.tab:reallySelected
     */

    /**
     * Fires when previous or next tab is selected and its content shown. Fires when user click on tab header or on
     * Prev or Next button.
     *
     * @event Wizard.wizard:selected
     *
     * @param {String} selector - Selected tab selector.
     */

    /**
     * Fires when saving action succeed, it means wizard's model is synced with server.
     *
     * @event Wizard.wizard:success
     *
     * @param {BaseModel} model - Instance of just synced model.
     */

    /**
     * Fires when saving data failed, it means wizard's model was not synced with server.
     *
     * @event Wizard.wizard:error
     *
     * @param {BaseModel} model - Instance of model which should be synced.
     */

    /**
     * Fires when user clicks on "Cancel" button.
     *
     * @event Wizard.wizard:cancel
     */

    var WizardView = {

        _linkPrefix: 'wizardTab' + _.random(111, 999), // overridden, really needed?
        _SERVER_ERROR: '###', // special key, there errors are shown at the top

        /**
         * Creates tabbed view according to tabs options.
         *
         * @return {void}
         */
        initialize: function () {
            var
                last,
                current,
                selector1,
                tab;

            // this.tabs or this.options.tabs are allowed
            if (this.options.tabs) {
                this.tabs = this.options.tabs;
            }

            if (this.tabs === undefined || this.tabs.length < 2) {
                throw new Error('Ui.Wizard: please specify tabs before calling constructor.');
            }

            this.options.text = this.options.text || '';

            this._subviews = {}; // hash map for
            this._lastSelector = '';

            // create tabbed views with buttons and empty slot for content view
            // use special id to avoid working with tabs directly by addTab()
            for (tab in this.tabs) {
                if (this.tabs.hasOwnProperty(tab)) {
                    selector1 = this.tabs[tab].selector;
                    this._lastSelector = this._lastSelector || selector1; // the first tab is the last selector now
                    this._subviews[selector1] = {};
                }
            }

            // link all tabs between by adding .prev and .next pointer
            last = null;
            for (tab in this.tabs) {
                if (this.tabs.hasOwnProperty(tab)) {
                    current = this.tabs[tab].selector;
                    if (last) {
                        this._subviews[current].prev = last;
                        this._subviews[last].next = current;
                    }
                    last = current;
                }
            }

            // beware of tab:selected - it's beforeSelected in fact, but kept to keep API
            this.on('tab:reallySelected', function (selector2) {
                if (selector2 !== this._lastSelector && this._synchronizePreviousTabs(selector2, this._lastSelector)) {
                    this.trigger('wizard:selected', selector2);

                    this._lastSelector = selector2;
                }
            }, this);

            ParentClass.prototype.initialize.apply(this, arguments);
        },

        /**
         * Sets tab content by placing given subview on proper place.
         *
         * @method Wizard.setTabContent
         *
         * @param {BaseView} view - Instance of view to be displayed as tab content.
         * The "validate()" method of this subview is called if present befor switching to prev or next tab.
         * @param {String} selector - Existing selector of given tab, equal to the "options.tabs.selector" value.
         *
         * @return {this}
         */
        setTabContent: function (view, selector) {
            var
                tabContent,
                caption,
                buttonsContainer,
                prevTab,
                nextTab;

            if (this._subviews.hasOwnProperty(selector)) {
                // add Prev/Next/Submit buttons
                prevTab = this._subviews[selector].prev;
                nextTab = this._subviews[selector].next;

                buttonsContainer = new ContainerView({className: 'iw-c-form-submit'});

                if (prevTab) {
                    buttonsContainer.append(this._getPrevButton(prevTab));
                }
                if (nextTab) {
                    buttonsContainer.append(this._getNextButton(nextTab, view));

                // no next = the last
                } else {
                    buttonsContainer.append(this._getSubmitButton());
                }

                // always add Cancel button
                buttonsContainer.append(this._getCancelButton());

                // tab container is already created by ParentClass
                tabContent = this._contentsContainer.getView(selector);
                tabContent.removeViews().append(view).append(buttonsContainer);

                // caption shown at the top of all tabs
                if (this.options.text !== '') {
                    caption = new HeadlineView({text: this.options.text, level: 1});
                    tabContent.prepend(caption);
                }

                this._subviews[selector].view = view;

                // all wizard subviews with model and set/getValues are listening on model changes
                if (this.model && view.model && this.model == view.model && view.setValues && view.getValues) {
                    this.model.on('change', function () {
                        view.setValues(this.model.attributes);
                    }, this);
                    // not implemented: call .off when replacing contentView
                }
            } else {
                throw new Error('Ui.Wizard: cannot set content of unexisting tab, available selectors:'
                    + _.keys(this._subviews).join(',') + '.');
            }

            return this;
        },

        /**
         * Gets tab content subview instance.
         *
         * @method Wizard.getTabContent
         *
         * @param {String} selector - Existing selector of given tab, equal to the "options.tabs.selector" value.
         *
         * @return {BaseView}
         */
        getTabContent: function (selector) {
            if (this._subviews.hasOwnProperty(selector) === false) {
                throw new Error('Ui.Wizard: the subview "' + selector + '" does not exits, available selectors:'
                    + _.keys(this._subviews).join(',') + '.');
            }

            return this._subviews[selector].view;
        },

        /**
         * Overridden.
         *
         * Tries to select tab of given selector, it means to show proper tab content. Contrary to Ui.Tabs
         * selecting tabs might end with failure when current tab subview contains invalid user input
         * values, because "subview.validate()" method is called if found before and must return "true" to finish
         * selecting. Otherwise current tab is still selected to show to validation error.
         *
         * Does nothing when wizard is not rendered yet or if tab of given selector doesn't exist.
         *
         * @method Wizard.selectTab
         *
         * @param {String} selector - Selector of tab to be shown.
         *
         * @return {this}
         */
        selectTab: function () {
            // the click() inside finally fires event wizard:selected
            return ParentClass.prototype.selectTab.apply(this, arguments);
        },

        /**
         * Fake method. Can be implemented later if be useful.
         *
         * @return {void}
         */
        getValues: function () {
            throw new Error('Ui.Wizard: not implemented, please use view.getValues() for all subviews instead.');
        },

        /**
         * Fake method. Can be implemented later if be useful.
         *
         * @return {void}
         */
        setValues: function () {
            throw new Error('Ui.Wizard: not implemented, please use view.setValues() for all subviews instead.');
        },

        /**
         * Checks if some tab has upload file field.
         *
         * @return {Boolean}
         */
        hasUpload: function () {
            var
                uploadFields = this.getUploadFields();

            return (uploadFields.length > 0);
        },

        /**
         * Gets all upload file fields found in any of tab.
         *
         * @return {Array} array of Ui.File instances
         */
        getUploadFields: function () {
            var
                uploadFields = [],
                selector,
                view;

            for (selector in this._subviews) {
                if (this._subviews.hasOwnProperty(selector)) {
                    view = this._subviews[selector].view;

                    if (view.getUploadFields) {
                        uploadFields = _.union(uploadFields, view.getUploadFields());
                    }
                }
            }

            return uploadFields;
        },

        /**
         * Submits data from all tabs by calling view.validate() and view.getValues()
         *
         * @param {Object} values - Allows to work with given values instead of reading values from subviews.
         * Useful when need to override submit and modify the values before submitting.
         * See mail templates for more details.
         *
         * @return {this}
         */
        submit: function (values) {
            var
                selector,
                view;

            // very similar to Ui.Form
            if (!this.model) {
                throw new Error('Ui.Wizard: submit failed becase model is not set.');
            }

            // must be here, see comments below
            this._registerOnceServerErrorHandler();

            this.mask();

            // read values from subviews (default way)
            if (values === undefined) {
                values = {};

                for (selector in this._subviews) {
                    if (this._subviews.hasOwnProperty(selector)) {
                        view = this._subviews[selector].view;

                        // call validate if present and show errors if any
                        if (view.validate && view.validate() === false) {
                            this.selectTab(selector);
                            this.unmask();
                            return this; // skip submit
                        }

                        if (view.getValues) {
                            values = _.extend(values, view.getValues()); // the last win, is it OK?
                        } else if (view.getValue) { // obsolete
                            values = _.extend(values, view.getValue());
                        }
                    }
                }
            }

            // bind once to avoid firing this event when fetching model
            this.model.once('sync', function (model, response, options) {
                this.unmask();
                this.trigger('wizard:success', model);
            }, this);
            this.model.once('error', function (model, xhr, options) {
                this.unmask();
                this.trigger('wizard:error', model);
            }, this);

            if (!this.hasUpload()) {
                this.model.save(values); // it fires wizard:success/error finally
            } else {
                this._submitWithUpload(values); ///
            }

            return this;
        },

        /**
         *
         * @return {this}
         */
        _registerOnceServerErrorHandler: function () {
            // register once and after all subviews are already registered
            // cannot be set in this.initialize() because subview.isErrorShown() is used to detect which tab to select
            // all subviews have to listen to the model before this wizard to have fresh info in this moment
            if (this._isRegisteredServerErrorHandler !== true) {
                this._isRegisteredServerErrorHandler = true; // semafor

                // explicitely registered, because TabsView is not Ui.Container
                IW.MVRegistry.add(this, this.model);

                // server validation error, by model.save
                var self = this;
                this.registerErrorHandler(this.model, {
                    400: {

                        /**
                         * Process server validation errors.
                         *
                         * @return {void}
                         */
                        handler: function () {
                            var
                                selector,
                                view,
                                selectTabWithError = true;

                            for (selector in self._subviews) {
                                if (self._subviews.hasOwnProperty(selector)) {
                                    view = self._subviews[selector].view;

                                    if (selectTabWithError && view.isErrorShown && view.isErrorShown()) {
                                        self.selectTab(selector);
                                        selectTabWithError = false; // first tab with error selected, BREAK
                                    }
                                }
                            }
                        }
                    }
                }, true); // Ui.Form subviews are masters, so Ui.Wizard must be too
            }

            return this;
        },

        /**
         * Validates previous tabs and the first invalid is selected if any, otherwise data are passed to other tabs
         * by updating model used by all tab subviews.
         *
         * @param {String} selectedTab - Selector of the tab which has to be selected if previous are valid.
         * @param {String} lastSelectedTab - Selector of the just left tab, must be validated too, because is logically
         * also previous.
         *
         * @return {Boolean} TRUE if previous tabs are valid
         */
        _synchronizePreviousTabs: function (selectedTab, lastSelectedTab) {
            var
                isValid = true,
                selector;

            isValid = this._synchronizeTab(lastSelectedTab); // check current

            for (selector in this._subviews) {
                if (this._subviews.hasOwnProperty(selector)) {
                    if (isValid == false || selector === selectedTab) {
                        break; // check only previous tabs, do not show validation error on not visited tabs
                    }

                    // do not validate last selected tab twice
                    if (selector !== lastSelectedTab) {
                        isValid = this._synchronizeTab(selector);
                    }
                }
            }

            return isValid;
        },

        /**
         * Validates given tabs and select it when invalid, otherwise data are passed to other tabs
         * by updating model used by all tab subviews.
         *
         * @param {Selector} selector - Tab selector.
         *
         * @return {Boolean} TRUE if given tab is valid
         */
        _synchronizeTab: function (selector) {
            var
                isValid = true,
                view;

            view = this._subviews[selector].view;

            // call validate if present and show errors if any
            // and store subset of attributes if valid
            if (view.validate) {
                if (view.validate() === false) {
                    this.selectTab(selector);
                    isValid = false;
                } else {
                    // storing of values fires "change" event and all subviews setValues() are called
                    this.model.set(view.getValues());
                }
            }

            return isValid;
        },

        /**
         * Gets "cancel" button view with set click handler.
         *
         * @return {BaseView}
         */
        _getCancelButton: function () {
            var
                clickHandler;

            /**
             * @return {void}
             */
            clickHandler = function () {
                this.trigger('wizard:cancel');
            };

             // ?? revert model attributes, model.set() could change it when switching tabs
            return new LinkButtonView({text: 'core.cancel'}).on('click', clickHandler, this);
        },

        /**
         * Gets "prev" button view with set click handler.
         *
         * @param {String} selector - Tab selector.
         *
         * @return {BaseView}
         */
        _getPrevButton: function (selector) {
            var
                clickHandler;

            /**
             * @return {void}
             */
            clickHandler = function () {
                this.selectTab(selector);
            };

            return new ButtonView({text: 'core.form.prev'}).on('click', clickHandler, this);
        },

        /**
         * Gets "next" button view with set click handler.
         *
         * @param {String} selector - Tab selector.
         *
         * @return {BaseView}
         */
        _getNextButton: function (selector) {
            var
                clickHandler;

            /**
             * @return {void}
             */
            clickHandler = function () {
                this.selectTab(selector);
            };

            return new ButtonView({text: 'core.form.next'}).on('click', clickHandler, this);
        },

        /**
         * Gets "submit" button view with set click handler.
         *
         * @param {String} selector - Tab selector.
         *
         * @return {BaseView}
         */
        _getSubmitButton: function () {
            return new ButtonView({text: 'core.save'}).on('click', function () {
                this.submit();
            }, this);
        },

        /**
         * Submit form values with file upload
         *
         * !!! IF YOU MODIFY THIS METHOD, CHECK SAME METHOD IN /fclient/core/views/form/form.js !!!
         *
         * @param {Object} values - Wizard values.
         *
         * @return {void}
         */
        _submitWithUpload: function (values) {
            var
                self = this,
                submitFunction;

            var uploadFields = this.getUploadFields();
            var attributes = {
                method:  'POST',
                action:  _.isFunction(this.model.url) ? this.model.url() : this.model.url,
                enctype: 'multipart/form-data'
            };

            // call field mapping if any, see core/models/baseModel for more details
            if (this.model && this.model.fieldMapping) {
                values = this.model.fieldMapping(values);
            }

            // IE compatibility reason.
            // Since IE < 10 does not support ajax file uploads,
            // the plugin simulates the user experience by submitting the original form with the response targeted
            // to a dynamically created iframe. When the iframe loads the server response,
            // the plugin extracts the response and invokes callback handlers.
            if (Browser.isMsie9AndLower() && window.iwSecToken) {
                values['X-CSRFToken'] = window.iwSecToken;
            }

            var json     = IW.utils.stringify(values);
            var hidden   = IW.$('<input name="payload" type="hidden" />').val(json);
            var fakeForm = IW.$('<form/>').attr(attributes).append(hidden);

            //IEs need that form is rendered in DOM
            IW.$('body').append(fakeForm.hide());

            //move file fields into fake form and replaced by clones
            //take a note that Chrome lost info about selected files
            // Same part code is in form.js.
            _.each(uploadFields, function (uploadFieldView) {
                var i, replace, copyUploadFieldView = uploadFieldView.$el.clone();

                // append cloned form to fake form
                copyUploadFieldView.appendTo(fakeForm);

                // #23466 It works with only file inputs which are replaced to the fake form.
                // View can contain more elements with events. We need to preserve these dependencies.
                var originInputs = uploadFieldView.$el.find('input[type="file"]');
                var clonedInputs = copyUploadFieldView.find('input[type="file"]');

                for (i = 0; i < clonedInputs.length; i++) {
                    // First must be replaced with original clone and it must be replaced to clone in fake form.
                    // Only firefox cloned all file attributes, other browsers cloned as a blank entry.
                    replace = IW.$(originInputs[i]).replaceWith(IW.$(originInputs[i]).clone());
                    IW.$(clonedInputs[i]).replaceWith(replace);
                }
            });

            // #23468 IE9 sends empty file inputs, that is bad (our rest API doesn't receive empty files)
            // this remove all empty file inputs
            var uploadInputs = fakeForm.find('input[type="file"]');
            uploadInputs.each(function (index, element) {
                if (_.isEmpty(IW.$(element).val())) {
                    IW.$(element).remove();
                }
            });

            /**
             * @return {void}
             */
            submitFunction = function () {
                // missing scope in _uploadSuccess and _uploadError causes JS error in Ui.Wizard

                // ?? uiutils can be deleted and this method moved here and into form, mixin?
                IW.uiUtils.submitForm(fakeForm, {

                    /**
                     * @param {Object} xhr - jQuery xhr.
                     * @param {Integer} status - Xhr status.
                     * @param {Object} data - Passed data.
                     *
                     * @return {void}
                     */
                    success: function (xhr, status, data) {
                        // ?? move to function, used 2x
                        self.model.set('id', data.id);
                        self.unmask();
                        self.trigger('wizard:success', self.model);
                    },

                    /**
                     * @param {Object} response - Xhr response object.
                     *
                     * @return {void}
                     */
                    error: function (response) {
                        // ?? move to function, used 2x
                        self.unmask();
                        self.model.handleError(self.model, response);
                        self.trigger('wizard:error', self.model);
                    }
                });
            };

            // started a little later to give time to render masking DIV, ticket #20797
            setTimeout(submitFunction, 22); // 22 is nice number
        }
    };

    return ParentClass.extend(WizardView);
});
