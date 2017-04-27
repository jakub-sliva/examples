/**
 * User info component - admin prespective.
 * It contains Profile image, Standard Name, Company and Function Field, User ID, E-mail address.
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
         * Overridden method builds info about admin except Profile image (has been already built).
         *
         * @param {BaseModel} user Model of user.
         *
         * @return {View}
         */
        _buildInfoView: function (user) {
            var view = new Ui.Container({className: 'iw-c-userInfo-infoView'});

            view.appendIf(Builder.buildStandardNameView(user, this.externLink));
            view.appendIf(Builder.buildCompanyFieldView(user));
            view.appendIf(Builder.buildFunctionFieldView(user));

            return view;
        }
    };

    return ParentClass.extend(UserInfoView);
});
