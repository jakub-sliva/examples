/**
 * Base class of user info component.
 *
 * @author    Jakub Sliva <j.sliva@seznam.cz>
 * @category  Example
 *
 */
define([
    'core/ui',
    'core/views/ui/userInfo/builder'
], function (
    Ui,
    Builder
) {
    var ParentClass = Ui.Container;

    var UserInfoView = {

        /**
         * Initialize.
         *
         * @return {void}
         */
        initialize: function () {
            this._user      = this.options.data || {};
            this.externLink = this.options.externLink || null;
            this._hideActionsIcon = Boolean(this.options.hideActionsIcon);

            this.append(Builder.buildIconView(this._user, this.externLink));
            this.append(this._buildInfoView(this._user));

            return this;
        },

        /**
         * To override in subclasses.
         * Creates a container which contains info about one user/admin according of implementation in the subclasses.
         * It builds info about user except Profile image (has been already built).
         *
         * @param {BaseModel} user Model of user.
         *
         * @return {Ui.Container}
         */
        _buildInfoView: function (user) {
            throw new Error('Method _buildUserView must be overriden!');
        }
    };

    return ParentClass.extend(UserInfoView);
});
