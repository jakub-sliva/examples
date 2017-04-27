<?php
namespace IW_Core_BackgroundJob;

use IW\Core\AbstractService;
use IW\Core\Export\Helper\File as ExportFileHelper;
use IW\Core\Attribute\Enum\Entity as ExportEntityType;

/**
 * This class represents service for background jobs.
 *
 * @author     Jakub Sliva <j.sliva@seznam.cz>
 * @category   Example
 * 
 */
class Service extends AbstractService
{
    /**
     * Default settings for list - order-by column
     */
    const DEFAULT_LIST_SORT_BY = 'created';

    /**
     * Default settings for list - order
     */
    const DEFAULT_LIST_SORT_ORDER = IW_Core_ListFilter::ASC;

    /**
     * Data access object
     *
     * @var IW_Core_BackgroundJob_Dao
     */
    private $_dao;

    /**
     * Constructor
     */
    public function __construct() {
        $this->_dao = IW_Core_BeanFactory::singleton('IW_Core_BackgroundJob_Dao');
    }

    /**
     * Creates a new background job.
     *
     * @param IW_Core_BackgroundJob_Vo $job Object of background job
     *
     * @return int - ID of the saved record
     *
     * @iwAuthorized service
     */
    public function createBackgroundJob(IW_Core_BackgroundJob_Vo $job) {
        IW_Core_Validate::checkIsEntityId($job->getCreatorId());
        IW_Core_Validate::checkIsEntityId($job->getNetworkId());
        IW_Core_Validate::checkIsEnumValue($job->getType(), 'IW_Core_BackgroundJob_Enum_Type');

        //auth begin
        IW_Core_Acl::getInstance()->allow('BACKGROUND_JOB-CREATE', $job);
        //auth end

        $jobId = $this->_dao->createBackgroundJob($job);

        IW_Core_Log::getLogger($this)->info('Export background job started with id=%s.', array($jobId));

        $job->setId($jobId);

        return $jobId;
    }

    /**
     * Getter.
     *
     * @param int $id ID of the job
     *
     * @return IW_Core_BackgroundJob_Vo Job Vo
     *
     * @iwAuthorized service
     */
    public function getBackgroundJobById($id) {
        IW_Core_Validate::checkIsEntityId($id);

        $backgroundJob = $this->_dao->getBackgroundJobById($id);

        //auth begin
        IW_Core_Acl::getInstance()->allow('BACKGROUND_JOB-READ', $backgroundJob);
        //auth end

        $backgroundJob = $this->_addMetaToBgJobVo($backgroundJob);

        return $this->_transformBgJobVoByBusinessConditions($backgroundJob);
    }

    /**
     * Starts a background job. Sets its state to IN_PROGRESS and sets its 'started' time.
     *
     * @param int $id ID of the job
     *
     * @return void
     *
     * @iwAuthorized service
     */
    public function startBackgroundJob($id) {
        IW_Core_Validate::checkIsEntityId($id);

        //auth begin
        $job = $this->_dao->getBackgroundJobById($id);
        IW_Core_Acl::getInstance()->allow('BACKGROUND_JOB-UPDATE', $job);
        //auth end

        $jobVo = new IW_Core_BackgroundJob_Vo();
        $jobVo->setStarted(time());
        $jobVo->setState(IW_Core_BackgroundJob_Enum_State::IN_PROGRESS);

        $this->_dao->updateBackgroundJob($id, $jobVo);
    }

    /**
     * Finishes a background job. Sets its state, 'finished' time, and result
     *
     * @param int   $id      ID of the job
     * @param array $result  Array with result of the job, if there's any
     * @param bool  $success Whether the job finished successfully or not
     *
     * @return void
     *
     * @iwAuthorized service
     */
    public function finishBackgroundJob($id, array $result=array(), $success=true) {
        IW_Core_Validate::checkIsEntityId($id);
        IW_Core_Validate::checkIsBoolean($success);

        //auth begin
        $job = $this->_dao->getBackgroundJobById($id);
        IW_Core_Acl::getInstance()->allow('BACKGROUND_JOB-UPDATE', $job);
        //auth end

        $jobVo = new IW_Core_BackgroundJob_Vo();
        $jobVo->setFinished(time());
        $jobVo->setState($success ? IW_Core_BackgroundJob_Enum_State::DONE : IW_Core_BackgroundJob_Enum_State::ERROR);
        $jobVo->setMetaResult($result);

        $this->_dao->updateBackgroundJob($id, $jobVo);
    }

    /**
     * Sets the numeric progress of the background job
     *
     * @param int   $id       ID of the job
     * @param float $progress Progress expressed as a percentage
     *
     * @return void
     *
     * @iwAuthorized service
     */
    public function setProgress($id, $progress) {
        IW_Core_Validate::checkIsEntityId($id);

        //auth begin
        $job = $this->_dao->getBackgroundJobById($id);
        IW_Core_Acl::getInstance()->allow('BACKGROUND_JOB-UPDATE', $job);
        //auth end

        if ($progress < 0 || $progress > 100) {
            throw new IW_Core_IllegalStateException(
                'Progress value must be between 0 and 100, current value is '.$progress
            );
        }

        $jobVo = new IW_Core_BackgroundJob_Vo();
        $jobVo->setProgress($progress);

        $this->_dao->updateBackgroundJob($id, $jobVo);
    }

    /**
     * Finds background jobs according to given filter parameters.
     *
     * @param int                $userId     (optional, default: current user) ID of user (it's used for "only-mine")
     * @param int[]              $networkIds (optional, default: current network subtree) array of networkIDs
     * @param IW_Core_ListFilter $listFilter (optional) filter
     *
     * @return IW_Core_BackgroundJob_Vo[] array of VOs
     *
     * @iwAuthorized dao
     */
    public function findBackgroundJobs($userId=null, array $networkIds=null, IW_Core_ListFilter $listFilter=null) {
        IW_Core_Validate::checkIsEntityId($userId, null);
        IW_Core_Validate::checkIsEntityIds($networkIds, null);

        //default business params (background jobs are visible for current user and current network and subtnetworks)
        $userId     = $userId === null ? IW_Core_Utils_CurrentUser::getId() : $userId;
        $networkIds = $networkIds === null ? IW_Core_Utils_CurrentUser::getCurrentNetworkAndSubnetworks() : $networkIds;

        //default behavior of list
        if ($listFilter === null) {
            $listFilter = new IW_Core_ListFilter();
            $listFilter->addSortingOption(
                IW_Core_List_Enum_ListSortingOptions::SORT_BY, self::DEFAULT_LIST_SORT_BY
            );
            $listFilter->addSortingOption(
                IW_Core_List_Enum_ListSortingOptions::SORT_ORDER, self::DEFAULT_LIST_SORT_ORDER
            );
        }

        return $this->_dao->findBackgroundJobs($userId, $networkIds, $listFilter);
    }

    /**
     * Gets count of bgjobs according to given filter parameters.
     *
     * @param int                $userId     (optional, default: current user) ID of user (it's used for "only-mine")
     * @param int[]              $networkIds (optional, default: current network subtree) array of networkIDs
     * @param IW_Core_ListFilter $listFilter (optional) filter
     *
     * @return int get count of bgjobs
     *
     * @iwAuthorized dao
     */
    public function getCountOfBackgroundJobs($userId=null, array $networkIds=null, IW_Core_ListFilter $listFilter=null){
        IW_Core_Validate::checkIsEntityId($userId, null);
        IW_Core_Validate::checkIsEntityIds($networkIds, null);

        //default business params (background jobs are visible for current user and current network and subtnetworks)
        $userId     = $userId === null ? IW_Core_Utils_CurrentUser::getId() : $userId;
        $networkIds = $networkIds === null ? IW_Core_Utils_CurrentUser::getCurrentNetworkAndSubnetworks() : $networkIds;

        return $this->_dao->getCountOfBackgroundJobs($userId, $networkIds, $listFilter);
    }

    /**
     * Gets filename for given bgjob id and filename
     *
     * @param int    $id       ID of bgjob
     * @param string $filename filename
     *
     * @return string filename (full path) of file
     *
     * @throws IW_Core_IllegalStateException    when bgjob don't support file result
     * @throws IW_Core_IllegalArgumentException when wrong filename is given
     */
    public function getFile($id, $filename) {
        //auth begin
        $bgJob = $this->getBackgroundJobById($id);
        //auth end

        $fullpath = null;

        switch ($bgJob->getType()) {
            case IW_Core_BackgroundJob_Enum_Type::EXPORT:
                $fullpath = $this->_getFileExports($bgJob, ExportEntityType::USER, $filename);
                break;
            case IW_Core_BackgroundJob_Enum_Type::EXPORT_MODEMAN:
                $fullpath = $this->_getFileExports($bgJob, ExportEntityType::DYNAMIC_ENTITY, $filename);
                break;
            case IW_Core_BackgroundJob_Enum_Type::CLICK_AND_PRINT:
                $fullpath = $this->_getFileClickAndPrint($bgJob, $filename);
                break;
            default:
                throw new IW_Core_IllegalStateException('Bgjob ' . $bgJob->getType() . ' have no files');
                break;
        }

        return $fullpath;
    }

    /**
     * Gets full path to file from export (USER/MODEMAN)
     *
     * @param IW_Core_BackgroundJob_Vo $bgJob      bgjob
     * @param string                   $entityType Type of exported entity
     * @param string                   $filename   filename
     *
     * @return string full path
     *
     * @throws IW_Core_IllegalArgumentException when given filename is not valid fot this bgjob
     */
    private function _getFileExports(IW_Core_BackgroundJob_Vo $bgJob, $entityType, $filename) {
        $exportHelper = ExportFileHelper::getInstance();
        $metaResult   = $bgJob->getMetaResult();
        $metaInput    = $bgJob->getMetaInput();

        //is this file of bgjob? export have only result
        if (!isset($metaResult['filename']) || $metaResult['filename'] != $filename) {
            throw new IW_Core_IllegalArgumentException(
                'File "' . $filename . '" is not a result of bgjob id=' . $bgJob->getId()
            );
        }

        return $exportHelper->generateFilenameForLocalFile(
            $entityType,
            $metaInput['fileType'],
            $metaResult['localfile']
        );
    }

    /**
     * Gets full path to file for click and print
     *
     * @param IW_Core_BackgroundJob_Vo $bgJob    bgjob
     * @param string                   $filename filename
     *
     * @return string full path
     *
     * @throws IW_Core_IllegalArgumentException when given filename is not valid fot this bgjob
     */
    private function _getFileClickAndPrint(IW_Core_BackgroundJob_Vo $bgJob, $filename) {
        $capHelper  = IW_Core_BeanFactory::singleton('IW_User_ClickAndPrint_Helper');
        $metaResult = $bgJob->getMetaResult();
        $metaInput  = $bgJob->getMetaInput();

        //is this file of bgjob? export have only result
        if (!isset($metaResult['filename']) || $metaResult['filename'] != $filename) {
            throw new IW_Core_IllegalArgumentException(
                'File "' . $filename . '" is not a result of bgjob id=' . $bgJob->getId()
            );
        }

        return $capHelper->generateFilenameForLocalFile($metaInput['fileType'], $metaResult['localfile']);
    }

    /**
     * Transforms and modifies options in background job value object.
     *
     * 1. For type click and print checks if template id exists and if not then null will replace it's former id.
     *
     * @param IW_Core_BackgroundJob_Vo $bgJobVo background job's value object
     *
     * @return IW_Core_BackgroundJob_Vo
     */
    private function _transformBgJobVoByBusinessConditions($bgJobVo) {
        if ($bgJobVo->getType() === IW_Core_BackgroundJob_Enum_Type::CLICK_AND_PRINT) {
            $patternService = IW_Core_BeanFactory::singleton('IW_Core_Pattern_Service');
            $metaInput      = $bgJobVo->getMetaInput();
            $templateId     = isset($metaInput['templateId']) ? $metaInput['templateId'] : null;

            if ($templateId && !$patternService->existsPattern($templateId)) {
                $metaInput['templateId'] = null;
                $bgJobVo->setMetaInput($metaInput);
            }
        }

        return $bgJobVo;
    }

    /**
     * Adds meta to background job VO.
     *
     * @param IW_Core_BackgroundJob_Vo $bgJobVo Background job's value object
     *
     * @return IW_Core_BackgroundJob_Vo
     */
    private function _addMetaToBgJobVo($bgJobVo) {
        if ($bgJobVo->getType() === IW_Core_BackgroundJob_Enum_Type::CLICK_AND_PRINT) {
            $bgJobVo->storeMetadata('templateVisibility', $this->_createCaPTemplateVisibilityMeta($bgJobVo));
        }

        return $bgJobVo;
    }

    /**
     * Creates meta about CaP template visibility.
     *
     * @param IW_Core_BackgroundJob_Vo $bgJobVo Background job's value object
     *
     * @return array Visibility metadata
     */
    private function _createCaPTemplateVisibilityMeta($bgJobVo) {
        $patternService   = IW_Core_BeanFactory::singleton('IW_Core_Pattern_Service');
        $patternAssistant = IW_Core_BeanFactory::singleton('IW_Core_Pattern_BusinessAssistant');

        $meta       = array('visible' => false, 'deleted' => false, 'visibleInNetwork' => null);
        $metaInput  = $bgJobVo->getMetaInput();
        $templateId = isset($metaInput['templateId']) ? $metaInput['templateId'] : null;

        // is the relation to pattern present at all?
        if ($templateId) {
            // check whether the pattern was deleted
            if ($patternService->existsPattern($templateId)) {
                $patternVo    = $patternAssistant->getPattern($templateId);
                $patternNetId = $patternVo->getNetworkId();

                // is the current network same as the one where the pattern was created? (pattern is visible only
                // in network where it was created)
                if ($patternNetId == IW_Core_Utils_CurrentUser::getCurrentNetwork()) {
                    $meta['visible'] = true;
                } else {
                    $meta['visible'] = false;

                    // provide data about network where the pattern is visible (but only if the user has access to this
                    // net)
                    $orgstrService     = IW_Core_BeanFactory::singleton('IW_OrgStr_Core_Service');
                    $availableNetworks = $orgstrService->getNetworksForUser(null, null, 3);

                    if (array_key_exists($patternNetId, $availableNetworks)) {
                        $meta['visibleInNetwork'] = $patternNetId;
                    }
                }
            } else {
                $meta['deleted'] = true;
            }
        }

        return $meta;
    }
}
