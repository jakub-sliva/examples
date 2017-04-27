/**
 * User info component - simplified version.
 * It contains Profile image, Standard Name only.
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
         * Overridden method builds info about user/admin except Profile image (has been already built).
         *
         * @param {BaseModel} user Model of user.
         *
         * @return {Ui.Container}
         */
        _buildInfoView: function (user) {
            var view = new Ui.Container({className: 'iw-c-userInfo-infoView'});

            view.append(Builder.buildStandardNameView(user));

            return view;
        }
    };

    return ParentClass.extend(UserInfoView);
});
