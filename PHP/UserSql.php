<?php
namespace IW\Orgstr\User
                           
use IW\Core\Utils\DateTime;

/**
 * IW_OrgStr_User_UserDao class - represents user information
 *
 * @author     Jakub Sliva <j.sliva@seznam.cz>
 * @category   Example
 * 
 */
class UserSql extends \IW_Core_AbstractDao
{
    /**
     * Logging variable
     *
     * @var object
     */
    private $_logger;

    /**
     * Variable contains user table columns in view like
     * 'key'=>'value'  array level
     * value AS key    sql statement level
     *
     * @var array
     */
    private $_tableColumns = array();

    /**
     * Variable contains user table columns in view like
     * 'key'=>'value'  array level
     *
     * @var array
     */
    private $_userColumns = array();
    /**
     * Variable contains user table columns in view like
     * 'key'=>'value'  array level
     * value AS key    sql statement level
     *
     * @var array
     */
    private $_lookbookColumns = array();

    /**
     * Constructor
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct('user');
        $this->_logger = IW_Core_Log::getLogger($this);
    }

    /**
     * Method gets information about user by id
     *
     * @param int    $id   user id
     * @param string $lang code of current language
     *
     * @return object - value object of IW_Core_User_UserVo class
     *
     * @iwAuthorized service
     */
    public function getInfoById($id, $lang) {
        $db             = $this->getConnection();
        $fields         = $this->_tableColumns;
        $lookbookFields = $this->_lookbookColumns;

        $select = $db->select()
                  ->from(array('u'=>'user'), $fields)
                  ->joinLeft(array('l'=>'lookbook'), 'u.username=l.username', $lookbookFields)
                  ->where('u.nr = ?', (int)$id);

        if (isset($GLOBALS['MOD_TITEL_SELECT']) && $GLOBALS['MOD_TITEL_SELECT']) {
            $select->joinLeft(array('t'=>'user_titel'), 't.nr=u.titel', array('title'=>'t.name_'.$lang));
        }

        $stmt     = $db->query($select);
        $userInfo = $stmt->fetch();
        if (!$userInfo) {
            throw new IW_Core_DbException('No users selected by given id.');
        } else {
            $voItem = new IW_OrgStr_User_UserVo();
            $voItem->fromArray($userInfo, array_flip(array_merge($fields, $lookbookFields)));

            // Setting properties from joined lookbook table
            $voItem->setImage($userInfo['picture']);

            $profileUpdatedByUser = !empty($voItem->getProfileUpdatedByUser())
                        ? DateTime::gmDatetimeToUnixtime($voItem->getProfileUpdatedByUser()) : 0;

            $profileUpdatedByAnyone = !empty($voItem->getProfileUpdatedByAnyone())
                        ? DateTime::gmDatetimeToUnixtime($voItem->getProfileUpdatedByAnyone()) : 0;

            // change it to unix timestamp
            $voItem->setProfileUpdatedByUser($profileUpdatedByUser);
            $voItem->setProfileUpdatedByAnyone($profileUpdatedByAnyone);
        }

        $voItem->setAnrede1('');
        if ($voItem->getAnrede()) {
            $columnName = 'name_' . $lang;

            $select = $db->select()
                         ->from('user_anrede', array('name' => $columnName))
                         ->where('nr = ?', (int)$voItem->getAnrede());
            $anrede = $db->fetchCol($select);
            $voItem->setAnrede1($anrede[0]);
        }

        return $voItem;
    }

    /**
     * Method gets basic information about users by username, and also returns (only if the $actualUserAdminOes
     *     is not empty array), if the actual logged user is admin of users from usernames
     *
     * Returned information is:
     *    'username', 'nr', 'active', 'name', 'vorname', 'lookbook', 'isUnderAdminRight'
     *    Note: isUnderAdminRight is set to  null or 'username', and means, if actual user has admin rights to searched
     *          user
     *
     * @param array $usernames          usernames in array
     * @param array $actualUserAdminOes (optional) actual logged user admin oe ids
     *
     * @return object - value object of IW_Core_User_UserVo class
     *
     * @iwAuthorized dao
     */
    public function findBasicInfosByUsernames($usernames, $actualUserAdminOes=array()) {
        $result = array();
        if (!count($usernames)) {
            return $result;
        }

        $fields = array('username', 'id', 'active', 'lastName', 'firstName', 'lookbook');

        $db     = $this->getConnection();
        $select = $db->select()
            ->from(
                array('u'=>'user'),
                array('username',
                'id'=>'nr', 'active', 'lastName'=>'name', 'firstName'=>'vorname', 'lookbook')
            );

        if (count($actualUserAdminOes)) {
            $oeIds = implode(', ', $actualUserAdminOes);
            $select->joinLeft(
                ['uorg' => 'user_OE'],
                'uorg.user_id = u.nr AND uorg.status = 1 AND uorg.oeID IN (' . $oeIds . ')',
                ['isUnderAdminRight' => 'IF(uorg.user_id IS NULL, NULL, u.username)']
            );
            $fields[] = 'isUnderAdminRight';
        }

        $select->where('u.username in (?)', $usernames)
            ->order('u.name ASC')
            ->order('u.vorname ASC')
            ->group('u.username');

        //auth begin
        $options = array(
            'tableName' => 'u',
            'columnName' => 'nr',
            'columnType' => IW_Core_Authorization_Enum_OwnerType::OWNER_TYPE_USER_ID
        );
        $this->addFilter('user', 'visible', $select, $options);
        //auth end

        $stmt = $db->query($select);

        while ($row = $stmt->fetch()) {
            $userVo = new IW_OrgStr_User_UserVo();
            $userVo->fromArray($row, $fields);
            $result[$userVo->getUsername()] = $userVo;
        }

        // Filter result of value, that was not set
        return $result;
    }


    /**
     * Convert function - array of usernames => array of user ids
     *
     * @param array $usernames array of usernames
     *
     * @return array of relevant ids
     */
    public function getIdsByUsernames($usernames)
    {
        $db  = $this->getConnection();
        $sql = $db->select()
            ->distinct()
            ->from(array('u'=>'user'), array('id' => 'nr'))
            ->where('u.username in (?)', $usernames);

        return $db->fetchCol($sql);
    }

    /**
     * Obtains informations about user updates
     * (last update by user, last update by anyone, last user update by anyone ID)
     *
     * @param int $userId User ID
     *
     * @return array of informations about user's updates
     */
    public function obtainProfileUpdateDataByUserId($userId) {
        $db     = $this->getConnection();
        $select = $db->select()
                     ->from(
                         $this->_tableName,
                         array(
                             'profileUpdateByUser' => 'user.profile_updated_by_user',
                             'profileUpdatedByAnyone' => 'user.profile_updated_by_anyone',
                             'profileUpdatedByAnyoneId' => 'user.profile_updated_by_anyone_id'
                         )
                     )
                     ->where('user.nr = ?', $userId);

        $stmt = $db->query($select);

        $row = $stmt->fetch();
        if (!$row) {
            throw new IW_Core_NotFoundException('No user with id=' . $userId . 'found.');
        }

        if (!empty($row['profileUpdateByUser']) && $row['profileUpdateByUser'] != '0000-00-00 00:00:00') {
            $row['profileUpdateByUser'] = DateTime::gmDatetimeToUnixtime($row['profileUpdateByUser']);
        } elseif ($row['profileUpdateByUser'] == '0000-00-00 00:00:00') {
            $row['profileUpdateByUser'] = null;
        }

        if (!empty($row['profileUpdatedByAnyone']) && $row['profileUpdatedByAnyone'] != '0000-00-00 00:00:00') {
            $row['profileUpdatedByAnyone'] = DateTime::gmDatetimeToUnixtime($row['profileUpdatedByAnyone']);
        } elseif ($row['profileUpdatedByAnyone'] == '0000-00-00 00:00:00') {
            $row['profileUpdatedByAnyone'] = null;
        }

        return $row;
    }

    /**
     * Method gets informations about users by ids.
     *
     * @param array  $userIds user ids
     * @param string $lang    code of current language
     *
     * @return IW_OrgStr_User_UserVo[]
     */
    public function getFullInfosByIds($userIds, $lang='DE') {
        $db     = $this->getConnection();
        $select = $db->select()
                        ->from(array('u'=>'user'), $this->_tableColumns)
                        ->joinLeft(array('l'=>'lookbook'), 'u.username=l.username')
                        ->joinLeft(array('ua'=>'user_anrede'), 'ua.nr=u.anrede', array('anrede1'=>'ua.name_' . $lang))
                        ->joinLeft(
                            array('user_status'=>'user_status'), 'user_status.nr=u.status',
                            array('statusName'=>'user_status.name_'.$lang)
                        )
                        ->where('u.nr in (?)', $userIds);

        if (IW_Core_Config::getInstance()->get('MOD_TITEL_SELECT')) {
            $select->joinLeft(array('t'=>'user_titel'), 't.nr=u.titel', array('title'=>'t.name_'.$lang));
        }

        $stmt   = $db->query($select);
        $result = array();
        while ($userInfo = $stmt->fetch()) {
            if (!$userInfo) {
                $this->_logger->warning('No users selected by given id.');
                continue;
            } else {
                $voItem = new IW_OrgStr_User_UserVo();
                $voItem->fromArray($userInfo);

                $profileUpdated = !empty($voItem->getProfileUpdatedByUser())
                        ? DateTime::gmDatetimeToUnixtime($voItem->getProfileUpdatedByUser()) : 0;

                $voItem->setProfileUpdatedByUser($profileUpdated); // to unix timestamp
            }

            $result[$voItem->getId()] = $voItem;
        }

        return $result;
    }

    /**
     * Method check if given user exists or not
     *
     * @param int $userId - user id
     *
     * @return boolean - true if exists / false otherwise
     *
     * @iwAuthorized service
     */
    public function exists($userId) {
        $db     = $this->getConnection();
        $select = $db->select()
                     ->from(array('u'=>'user'), array('nr'))
                     ->where('u.nr = ?', $userId);

        return (bool)$db->fetchOne($select);
    }

    /**
     * Method checks whether username exists.
     *
     * @param string $username username to check
     *
     * @return bool
     *
     * @iwAuthorized service
     */
    public function existsUsername($username) {
        $db     = $this->getConnection();
        $select = $db->select()
                     ->from(array('u'=>'user'), array('nr'))
                     ->where('u.username = ?', $username);

        return (bool)$db->fetchOne($select);
    }
}

