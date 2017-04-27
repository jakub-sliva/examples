/**
 * User Info is a standardized overview of user's profile.
 *
 * @author    Jakub Sliva <j.sliva@seznam.cz>
 * @category  Example
 *
 */
define([
    'core/ui',
    'core/views/ui/userInfo/utils',
    'core/views/ui/userInfo/userView',
    'core/views/ui/userInfo/adminView',
    'core/views/ui/userInfo/simpleView',
    'core/models/baseModel'
], function (
    Ui,
    Utils,
    UserView,
    AdminView,
    SimpleView,
    BaseModel
) {
    /**
     * @class     UserInfo
     * @classdesc It is a standardized overview of user's profile.
     * There are three possible prespectives:
     * 1) user perspective
     * 2) admin prespective
     * 3) simplified prespective - a special case; only profile image and standard name are shown.
     *
     * @extends ContainerView
     *
     * @param {Object|BaseModel} data - User's data|model of an user/admin. Params:
     * [role] - one of two values (user, admin) otherwise will be detected according to user's permissions.
     * id - ID of user
     * fullname - Standard name of user
     * [username] - depends on contactData property
     * [image] - path to profile image
     * [companyData.compadyName] - {id: <fieldId>, value: <fieldValue>}, already loaded value
     * [companyData.compadyPosition] - {id: <fieldId>, value: <fieldValue>}, already loaded value
     *
     * For user perspective:
     * [skype] - call via skype (just skype link)
     * [communitiesData] - list of objects, [{id: 1001, name: 'community 1001'}, ...]
     * [accessGroupsData] - list of objects, [{id: 1001, name: 'community 1001'}, ...]
     * [contactData] - {myContact: <boolean>, waitForConfirm: <boolean>, contactId: <userId>},
     *                 username of the user has to be set
     * [meta.VISIBILITY_TYPE] - has to be set on IW.enums.IW_User_User_Enum_BasicDataVisibilityType.ADMIN_OF_USER
     *
     * For admin perspective:
     * [email]
     *
     * @param {Boolean} simple - Set true for show simplified version of user info.
     * @param {Boolean} hideActionsIcon - Set true for hide of action icons.
     */

    var ParentClass = Ui.Container;

    var UserInfoView = {

        /**
         * Initialize.
         *
         * @return {void}
         */
        initialize: function () {
            this.options.hideActionsIcon = Boolean(this.options.hideActionsIcon);

            var view;

            // Always will be model.
            if (!(this.options.data instanceof BaseModel)) {
                this.options.data = new BaseModel(this.options.data);
            }

            if (this.options.simple) {
                view = new SimpleView({data: this.options.data});
            } else {
                switch (Utils.getRole(this.options.data)) {
                    case Utils.ROLES.ADMIN:
                        view = new AdminView({
                            data: this.options.data,
                            externLink: this.options.externLink
                        });
                        break;
                    case Utils.ROLES.USER:
                        view = new UserView({
                            data: this.options.data,
                            hideActionsIcon: this.options.hideActionsIcon,
                            externLink: this.options.externLink
                        });
                        break;
                    default:
                        throw new Error('Invalid role type.');
                }
            }

            this.add(view);

            return this;
        }
    };

    return ParentClass.extend(UserInfoView);
});
