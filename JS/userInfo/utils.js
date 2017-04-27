/**
 * Utilities and convenience functions for user info.
 *
 * @author    Jakub Sliva <j.sliva@seznam.cz>
 * @category  Example
 *
 */
define([], function () {
    return {

        ROLES: {
            USER: 'user',
            ADMIN: 'admin'
        },

        /**
         * Returns link to user detail by access rules.
         *
         * @param {BaseModel} user User object
         *
         * @return {String|null}
         */
        getLinkToUser: function (user) {
            var link               = null,
                meta               = user.get('meta') || {},
                visibilityType     = meta.VISIBILITY_TYPE,
                visibilityTypeEnum = IW.enums.IW_User_User_Enum_BasicDataVisibilityType,
                role               = this.getRole(user);

            if (meta.ACCESSIBLE) {
                if (role === this.ROLES.ADMIN && (visibilityType === visibilityTypeEnum.ADMIN_OF_USER)) {
                    // role and visibility is administrator
                    link = IW.utils.createUrl('user/admin/main#detail/' + user.get('id'));
                } else if (role === this.ROLES.USER
                        && (
                            (visibilityType === visibilityTypeEnum.VISIBLE)
                            || (visibilityType === visibilityTypeEnum.ADMIN_OF_USER)
                        )
                ) {
                    // role is user and user is visible or current user is admin of user
                    link = IW.utils.createUrl('profile.php?userId=' + user.get('id'));
                }
            }

            return link;
        },

        /**
         * Gets role of the user. Can be set manually otherwise will be detected according to permissions.
         *
         * @param {BaseModel} user User object
         *
         * @return {String|null}
         */
        getRole: function (user) {
            var meta = user.get('meta') || {},
                // Role can be set manually
                role = user.get('role');

            // Validation when the role is admin.
            if (role === this.ROLES.ADMIN
                    && meta.VISIBILITY_TYPE !== IW.enums.IW_User_User_Enum_BasicDataVisibilityType.ADMIN_OF_USER) {
                throw new Error(
                    'Ilegal state. The admin role is not allowed for "' + meta.VISIBILITY_TYPE + '" permission!'
                );
            }

            // If Role is not set and will be detected according to user's permissions
            if (!role) {
                if (meta.VISIBILITY_TYPE === IW.enums.IW_User_User_Enum_BasicDataVisibilityType.ADMIN_OF_USER) {
                    role = this.ROLES.ADMIN;
                } else {
                    role = this.ROLES.USER;
                }
            }

            return role;
        }
    };
});
