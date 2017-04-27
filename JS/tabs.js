/**
 * Ui.Tabs view class.
 *
 * @author    Jakub Sliva <j.sliva@seznam.cz>
 * @category  Example
 * 
 */
define([
    'core/views/component',
    'core/views/container',
    'core/views/ui/link',
    'core/views/ui/linkIcon',
    'text!core/templates/ui/tabs.html'
], function (
    ComponentView,
    ContainerView,
    LinkView,
    LinkIconView,
    tabsTemplate
) {
    // NOTE: Implemented as composit to ensure, that the tabs are rendered in correct element.
    var ParentClass = ComponentView;

    /**
     * @class     Tabs
     * @classdesc Component to display subviews as headers with their content, where only content of active tab is
     * visible at one moment. Wrapper for jQuery UI Tabs widget.
     *
     * The property "this.tabs" must be specified before calling "initialize()" method.
     *
     * @extends   ComponentView
     *
     * @param {Array} tabs - Configuration for tabs to be displayed.
     * @param {String} tabs.header - Text displayed as tab header (title).
     * @param {String} tabs.iconName - An icon of the tab placed before the title.
     * @param {String} tabs.selector - Tab content selector.
     *
     * @param {String} htmlId - Value of parent HTML tag's "id" attribute. Needed for styling.
     */

    /**
     * Fires when user clicks on tab header. This "selected" event occurs before "reallySelected", it means this events
     * just says user wants to show content of given tab.
     *
     * @event Tabs.tab:selected
     *
     * @param {String} selector - Selected tab selector.
     */

    /**
     * Fires when user clicks on tab header and given tab content is shown. There is a little difference between
     * "reallySelected" and "selected", important for descendant Ui.Wizard.
     *
     * @event Tabs.tab:reallySelected
     *
     * @param {String} selector - Selected tab selector.
     */
    var TabsView = {

        template: _.template(tabsTemplate),

        _linkPrefix: 'uiTab' + _.random(111, 999), // to avoid ID collission and CSS based on "selector" values

        /**
         * Constructor.
         *
         * @return {void}
         */
        initialize: function () {
            var
                i, cnt;

            this.tabs = this.options.tabs || this.tabs || [];

            this._headersContainer = new ContainerView({
                layout: ContainerView.layoutType.LIST,
                className: 'LayoutBox_headlineTabs'
            });
            this._contentsContainer = new ContainerView({layout: ContainerView.layoutType.DEFAULT});

            for (i = 0, cnt = this.tabs.length; i < cnt; i++) {
                this._appendTab(this.tabs[i]);
            }

            //first tab is selected by default
            this._selectedTab = _.first(this.tabs).selector;
        },

        /**
         * Renders tab headers and subviews and calls jQuery UI to decorate tabs.
         *
         * @method Tabs.afterRender
         *
         * @return {void}
         */
        afterRender: function () {
            var
                self = this;

            this.replaceSlot('HEADER', this._headersContainer);
            this.replaceSlot('CONTENT', this._contentsContainer);

            // needed by Ui.Wizard
            this.$el.tabs({

                /**
                 * @param {Object} event - jQuery event.
                 * @param {Object} ui - jQuery widget.
                 *
                 * @return {void}
                 */
                activate: function (event, ui) {
                    self.trigger('tab:reallySelected', ui.newPanel.attr('id').replace(self._linkPrefix, ''));
                }
            });

            if (this.options.htmlId) {
                this.$el.attr('id', this.options.htmlId); // dominic needs every LayoutBox has own ID html attr
            }
        },

        /**
         * Sets content of tab matching given selector. Does nothing if tab not found.
         *
         * @method Tabs.setTabContent
         *
         * @param {BaseView} view - Instance of BaseView descendant to be used as tab content.
         * @param {String} selector - Tab selector.
         *
         * @return {this}
         */
        setTabContent: function (view, selector) {
            if (this._contentsContainer.existsView(selector)) {
                this._contentsContainer.getView(selector).removeViews().add(view);
            }
            return this;
        },

        /**
         * Selects tab matching given selector, it means proper tab content is shown.
         * Does nothing when tabs is not rendered yet or if given tab not found.
         *
         * @method Tabs.selectTab
         *
         * @param {String} selector - Tab selector.
         * @return {this}
         */
        selectTab: function (selector) {
            var
                link = '#' + this._linkPrefix + selector,
                linkEl;

            if (this._headersContainer.existsView(selector)) {
                if (this._headersContainer.getView(selector).isHidden() === false) {
                    if (this.rendered) {
                        linkEl = this.$el.find('a[href$="' + link + '"]');
                        if (linkEl.length === 1) {
                            linkEl.click();
                        }
                    }
                }
            }

            return this;
        },

        /**
         * Returns selector of currently selected tab or the first if not rendered yet.
         *
         * @method Tabs.getSelectedTab
         *
         * @return {String}
         */
        getSelectedTab: function () {
            return this._selectedTab || ''; // empty string just to be sure
        },

        /**
         * Shows header and content of tab matching given selector. Does nothing if tab not found.
         *
         * @method Tabs.showTab
         *
         * @param {String} selector - Tab selector.
         * @return {this}
         */
        showTab: function (selector) {
            // no need to show content
            if (this._headersContainer.existsView(selector)) {
                this._headersContainer.getView(selector).show();
            }
            return this;
        },

        /**
         * Hides header and content of tab matching given selector. The first visible tab is selected if given tab
         * is currently selected. Does nothing if tab not found.
         *
         * @method Tabs.hideTab
         *
         * @param {String} selector - Tab selector.
         * @return {this}
         */
        hideTab: function (selector) {
            var
                firstShownTab;

            // cannot hide any tab if no available or if only is set, someone must be shown
            if (this.tabs.length < 2) {
                return this;
            }

            firstShownTab = this._findFirstShownTab(selector);

            // cannot hide current tab if there is no other tab to show
            if (firstShownTab === '') {
                return this;
            }

            if (this._headersContainer.existsView(selector)) {
                if (selector === this.getSelectedTab()) {
                    this.selectTab(firstShownTab);
                }

                // no need to hide content, is hidden by selecting other tab
                this._headersContainer.getView(selector).hide();
            }

            return this;
        },

        /**
         * Overridden.
         *
         * @return {this}
         */
        mask: function () {
            this._contentsContainer.mask();
            return this;
        },

        /**
         * Overridden.
         *
         * @return {this}
         */
        unmask: function () {
            this._contentsContainer.unmask();
            return this;
        },

        /**
         * Overridden.
         *
         * @return {this}
         */
        registerErrorHandler: function () {
            // Ui.Tabs is NOT container, pass down to content container
            this._contentsContainer.registerErrorHandler.apply(this._contentsContainer, arguments);
            return this;
        },

        /**
         * Overridden.
         *
         * Hides all result messages in content container.
         *
         * @param {Boolean} force - Set "true" to include subviews hierarchy.
         *
         * @return {this}
         */
        hideResults: function (force) {
            this._contentsContainer.hideResults(force);
            return this;
        },

        /**
         * Creates a new tab and appends it. Click handlers is set.
         *
         * @param {Object} tab - Tab {header, iconName, selector} configuration.
         *
         * @return {void}
         */
        _appendTab: function (tab) {
            var
                id = this._linkPrefix + tab.selector,
                link = '#' + id,
                headerView, tabContentView;

            if (tab.iconName) {
                headerView = new LinkIconView({
                    textAfterIcon: tab.header,
                    name: tab.iconName,
                    link: link,
                    layoutForTabs: true
                });
            } else {
                headerView = new LinkView({text: tab.header, link: link, layoutForTabs: true});
            }

            tabContentView = new ContainerView({id: id}); // expected by jQuery.UI

            this._headersContainer.add(headerView, tab.selector);
            this._contentsContainer.add(tabContentView, tab.selector);

            headerView.on('click', function () {
                this._clickHandler(tab.selector);
            }, this);
        },

        /**
         * Helper method to find out the first visible tab to be selected instead when hiding curretly selected tab.
         * Cannot hide such tab without selecting other.
         *
         * @param {String} currentSelector - Selector of currently selected tab.
         * @return {String}
         */
        _findFirstShownTab: function (currentSelector) {
            var
                result = '',
                selector,
                i, cnt;

            for (i = 0, cnt = this.tabs.length; i < cnt; i++) {
                selector = this.tabs[i].selector;

                if (selector !== currentSelector && this._headersContainer.getView(selector).isHidden() === false) {
                    result = selector;
                    break;
                }
            }

            return result;
        },

        /**
         * Handler for click on tabs header. Just fires proper event.
         *
         * @param {String} selector - Tab selector.
         *
         * @return {void}
         */
        _clickHandler: function (selector) {
            this._selectedTab = selector;
            this.trigger('tab:selected', selector);
        }
    };

    return ParentClass.extend(TabsView);
});