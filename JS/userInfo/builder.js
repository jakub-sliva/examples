/**
 * It builds parts of user info.
 *
 * @author    Jakub Sliva <j.sliva@seznam.cz>
 * @category  Example
 *
 */
define([
    'core/ui',
    'core/views/ui/userInfo/utils',
    'core/views/ui/profileImage',
    'context',
    'user/views/user/afield/detailValuesAdapter'
], function (
    Ui,
    Utils,
    ProfileImageView,
    IwContext,
    DetailValuesAdapter
) {
    return {

        /**
         * Method for added user picture in user info component.
         *
         * @param {BaseModel} user User object
         * @param {String}    link optional external link
         *
         * @return {ProfileImageView}
         */
        buildIconView: function (user, link) {
            return new ProfileImageView({
                user: user,
                title: user.get('fullname'),
                admin: (Utils.getRole(user) === 'admin'),
                link: link
            })
                // it's neccesary to use this setter
                // otherwise the default value images/web20/img/fakeportrait-60-n.png is set
                .setImageSource(user.get('image'));
        },

        /**
         * Method for display username in user info component.
         *
         * @param {BaseModel} user       User object
         * @param {String}    externLink Alternative link that will replace original link
         *
         * @return  {Ui.BaseView}
         */
        buildStandardNameView: function (user, externLink) {
            var view,
                role     = Utils.getRole(user),
                link     = Utils.getLinkToUser(user),
                fullname = user.get('fullname');

            if (externLink) {
                link = externLink;
            }

            if (link) {
                // link is available -> use link view
                view = new Ui.Link({
                    text: fullname,
                    link: link,
                    className: 'iw-c-userInfo-name'
                });
            } else {
                // user is deleted or is hidden -> show name only (not clicable)
                view = new Ui.Text({
                    text: fullname,
                    className: 'iw-c-userInfo-name'
                });
            }

            if (role === Utils.ROLES.ADMIN) {
                // add user id with special span to user name
                view = new Ui.TextWithLink({
                    text        : '#USER_NAME# #USER_ID#',
                    placeholders: {
                        '#USER_NAME#': view,    // name of user with/without link
                        '#USER_ID#'  : new Ui.Text({    // build additonal text for Admin role. Add id of user
                            text: '(' + user.get('id') + ')',
                            className: 'iw-c-userInfo-userId'
                        })
                    }
                });
            }

            return view;
        },

        /**
         * Method for display email in user info component.
         *
         * @param {BaseModel} user User object
         *
         * @return {Ui.Email}
         */
        buildEmailView: function (user) {
            var view = new Ui.Email({email : user.get('email')});

            return view;
        },

        /**
         * Method for added community and access group icon.
         *
         * @param {BaseModel} user User object
         *
         * @return {Ui.Container}
         */
        buildCommunityAndAccessIconView: function (user) {
            var
                communities  = user.get('communitiesData') || [],
                accessGroups = user.get('accessGroupsData') || [],
                communityContainer,
                accessGroupsContainer,
                communityAndAccessIcons;

            communityAndAccessIcons = new Ui.Container();

            if (IW.config.configuration.USER_SHOW_COMMUNITY_ICONS) {
                communityContainer = this._buildCommunityIconView(communities);
            }

            if (IW.config.configuration.USER_SHOW_ACCESS_GROUP_ICONS) {
                accessGroupsContainer = this._buildAccessGroupsIconView(accessGroups);
            }

            if (communityContainer && !_.isEmpty(communityContainer.getViews())) {
                communityAndAccessIcons.append(communityContainer);
            }

            if (accessGroupsContainer && !_.isEmpty(accessGroupsContainer.getViews())) {
                communityAndAccessIcons.append(accessGroupsContainer);
            }

            return communityAndAccessIcons;
        },

        /**
         * Method for added company info in user info component
         *
         * @param {BaseModel} user User object
         *
         * @return {Ui.Container|null}
         */
        buildCompanyFieldView: function (user) {
            var
                company,
                companyData = user.get('companyData') || {};

            if (companyData.hasOwnProperty('companyName')) {
                company = this._getAFComponent(companyData.companyName, 'iw-w-companyName');
            }

            return company;
        },

        /**
         * Method for added function info in user info component
         *
         * @param {BaseModel} user User object
         *
         * @return {Ui.Container|null}
         */
        buildFunctionFieldView: function (user) {
            var
                company,
                companyData = user.get('companyData') || {};

            if (companyData.companyPosition) {
                company = this._getAFComponent(companyData.companyPosition, 'iw-w-companyPosition');
            }

            return company;
        },

        /**
         * Method for added action icon for user info component.
         *
         * @param {BaseModel} user User object
         *
         * @return {Ui.Container}
         */
        buildActionIconView: function (user) {
            var
                link,
                icon,
                contactIcon,
                contactData,
                actionIcons;

            actionIcons = new Ui.Container({className: 'iw-c-userInfo-actions'});

            contactData = user.get('contactData') || {};

            //add or remove contact
            if (!_.isEmpty(contactData)) {
                // my contact -> remove contact action will be add into action set
                if (contactData.myContact === true && contactData.waitForConfirm === false) {
                    link = IW.utils.createUrl(
                        'contact.php',
                        {act: 'delete', contacts: contactData.contactId},
                        true
                    );

                    contactIcon = new Ui.LinkIcon({
                        name: 'removeContact',
                        label: IW.$.i18n._('core.removeContact'),
                        link: link
                    });
                }

                // not my contact but waiting for confirm -> remove contact action will be add into action set
                if (contactData.myContact === false && contactData.waitForConfirm === true) {
                    link = IW.utils.createUrl(
                        'contact_unconfirmed.php',
                        {act: 'recall', contacts: contactData.contactId},
                        true
                    );
                    contactIcon = new Ui.LinkIcon({
                        name: 'removeContact',
                        label: IW.$.i18n._('core.removeContact'),
                        link: link
                    });
                }

                // not my contact -> add contact action will be add into action set
                if (contactData.myContact === false && contactData.waitForConfirm === false) {
                    link = IW.utils.createUrl(
                        'profile.php',
                        {buddy_add: user.get('username'), user: user.get('username')},
                        true
                    );
                    contactIcon = new Ui.LinkIcon({
                        name: 'addContact',
                        label: IW.$.i18n._('core.addContact'),
                        link: link
                    });
                }

                actionIcons.append(contactIcon);
            }

            //send a message
            icon = new Ui.LinkIcon({name: 'message', label: IW.$.i18n._('core.email.send')});
            icon.setLink(IW.utils.createUrl('email/new.php?redirectType=ids&recipients=' + user.get('id')));
            actionIcons.append(icon);

            // skype
            var skype = user.get('skype');
            if (!_.isNull(skype) && skype !== '' && skype !== undefined && skype !== '$hidden') {
                actionIcons.append(new Ui.Icon({name: 'skype', title: user.get('skype')})); //skype
            }

            return actionIcons;
        },

        /**
         * Returns AF component for field.
         *
         * @param {Object} field - Apiname of field.
         * @param {String} className - Addes className of the created container.
         *
         * @return {Ui.Container}
         */
        _getAFComponent: function (field, className) {
            var view                = new Ui.Container({className: className}),
                detailValuesAdapter;

            IW.context = IwContext.getInstance();

            IW.synchronize(
                [
                    IW.context.getItem('staticFields'),
                    IW.context.getItem('additionalFields')
                ],
                function () {
                    var fieldValueView;

                    if (!_.isUndefined(field) && field !== null) {
                        detailValuesAdapter = new DetailValuesAdapter();
                        fieldValueView = detailValuesAdapter.getAFComponent(field.id, field.value);

                        if (fieldValueView) {
                            view.append(fieldValueView);
                        }
                    }
                },
                function () {
                    return;
                },
                this
            );

            return view;
        },

        /**
         * Method for building of communities icon container.
         *
         * @param {Array} communities Array of user's communities
         *
         * @return {Ui.Container}
         */
        _buildCommunityIconView: function (communities) {
            var communityContainer = new Ui.Container({className: 'iw-w-communityIcons'});

            _.each(communities, function (community) {
                if (community.icon !== null) {
                    communityContainer.append(
                        new Ui.Image({altText: community.name, imgSrc: community.icon})
                    );
                }
            });

            return communityContainer;
        },

        /**
         * Method for building of access groups icon container.
         *
         * @param {Array} accessGroups Array of user's access groups
         *
         * @return {Ui.Container}
         */
        _buildAccessGroupsIconView: function (accessGroups) {
            var accessGroupsContainer = new Ui.Container({className: 'iw-w-groupIcons'});

            _.each(accessGroups, function (accessGroup) {
                if (accessGroup.icon !== null) {
                    accessGroupsContainer.append(
                        new Ui.Image({altText: accessGroup.name, imgSrc: accessGroup.icon})
                    );
                }
            });

            return accessGroupsContainer;
        }
    };
});
