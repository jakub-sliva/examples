/**
 * User info component - user prespective.
 * User version of info component of one user.
 * It contains Profile image, Standard Name, Company and Function Fields, Community icons, Access groups icons,
 * Actions (add/remove contact, send a message, call via skype).
 *
 * @author    Jakub Sliva <j.sliva@seznam.cz>
 * @category  Example
 * 
 */
define([
    'core/ui',
    'core/views/ui/userInfo/abstractView',
    'core/views/ui/userInfo/builder'
], function (
    Ui,
    AbstractView,
    Builder
) {
    var ParentClass = AbstractView;

    var UserInfoView = {

        /**
         * Overridden method builds info about user except Profile image (has been already built).
         *
         * @param {BaseModel} user Model of user.
         *
         * @return {View}
         */
        _buildInfoView: function (user) {
            var view = new Ui.Container({className: 'iw-c-userInfo-infoView'});

            view.appendIf(Builder.buildStandardNameView(user, this.externLink));
            view.appendIf(Builder.buildCommunityAndAccessIconView(user));
            view.appendIf(Builder.buildCompanyFieldView(user));
            view.appendIf(Builder.buildFunctionFieldView(user));

            if (this._hideActionsIcon !== true) {
                view.appendIf(Builder.buildActionIconView(user));
            }

            return view;
        }
    };

    return ParentClass.extend(UserInfoView);
});