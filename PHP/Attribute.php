<?php

namespace IW\Core\Attribute;

use IW\Core\AbstractService;

use IW\Core\Attribute\Enum\Entity;
use IW\Core\Attribute\Enum\Usage;
use IW\Core\Attribute\Enum\OptionsKeys;
use IW\Core\Attribute\Core\EntityFactory;
use IW\Core\Attribute\Core\ValuesResult;
use IW\Core\Attribute\Core\AbstractEntity;
use IW\Core\Attribute\Helper\Instance as InstanceHelper;

use IW\Core\Attribute\Validator\Selector as SelectorValidator;

use IW\Core\Attribute\Selector\Helper as SelectorHelper;

use IW\ModeMan\Model\Service as ModelService;

use IW_Core_Validate;
use IW_Core_Context;
use IW_Core_Log;

use IW_Core_Validate_Exception;
use IW_Core_Authorization_Exception;
use IW_Core_NotFoundException;

/**
 * This service provides methods for getting attributes of entities and their values.
 *
 * @author     Jakub Sliva <j.sliva@seznam.cz>
 * @category   Example
 *
 * @method Service getInstance()
 */
class Service extends AbstractService
{

    /**
     * Get entities attributes in array.
     *
     * @param Entity[] $entities array of values from enum IW\Core\Attribute\Enum\Entity
     * @param Usage    $usage    value from enum IW\Core\Attribute\Enum\Usage
     *
     * @return array with attributes for entities prepared for rest client application
     *
     * @iwAuthorized in entity classes
     */
    public function getEntitiesStructure($entities, $usage) {
        // validation begin
        $validate = IW_Core_Validate::getInstance();
        $validate
            ->validEnum($usage, 'IW\Core\Attribute\Enum\Usage', 'usage');

        // Entities can contain string from enum or dynamic entities, e.g: DYNAMIC_ENTITIES.allTypes
        $this->_validateEntities($entities);

        $validate->checkValid();
        // validation end

        $entitiesUniq                      = array_unique($entities); // make sure each entity is there only once
        $structure                         = array(); // init return array
        $structure[Entity::DYNAMIC_ENTITY] = array();

        $options = array(
            OptionsKeys::LANG => IW_Core_Context::getInstance()->getLanguage()
        );

        foreach ($entitiesUniq as $entity) {
            if ($this->_isEntityType($entity, Entity::DYNAMIC_ENTITY)) {
                $apiName = $this->_getApiNameFromDynamicEntityType($entity);

                $entityVo = EntityFactory::createEntityForAttributes(
                    Entity::DYNAMIC_ENTITY,
                    $usage,
                    $options
                );

                $entityVo->setApiName($apiName);

                $structure[Entity::DYNAMIC_ENTITY][$apiName] = $entityVo->getAttributes();

                $baseEntities[$entity] = $entityVo;
            } else if ($this->_isEntityType($entity, Entity::MATCH)) {
                $configName = $this->_getApiNameFromMatchType($entity);

                $entityVo = EntityFactory::createEntityForAttributes(
                    Entity::MATCH,
                    $usage,
                    $options
                );

                $entityVo->setMatchName($configName);

                $structure[Entity::MATCH] = $entityVo->getAttributes();
                $baseEntities[$entity]    = $entityVo;
            } else {
                $entityVo           = EntityFactory::createEntityForAttributes($entity, $usage, $options);
                $structure[$entity] = $entityVo->getAttributes();

                $baseEntities[$entity] = $entityVo;
            }
        }

        $this->_loadSubEntities($structure, $baseEntities, $usage, $options);

        if (empty($structure[Entity::DYNAMIC_ENTITY])) {
            unset($structure[Entity::DYNAMIC_ENTITY]);
        }

        return $structure;
    }


    /**
     * Get array of entity attributes for selected $paths.
     *
     * Implemented only for DynamicEntity for now!
     *
     * @param Entity $entity array of values from enum IW\Core\Attribute\Enum\Entity
     * @param Usage  $usage  value from enum IW\Core\Attribute\Enum\Usage
     * @param array  $paths  array of attribute selector paths (properties.simpleTypes.urlField)
     *
     * @return array Array for each path in $paths with basic information about path.
     *
     * array(
     *    'properties.simpleTypes.urlField' => array(
     *         'path' => 'properties.simpleTypes.integerField',
     *         'type' => 'integer',
     *         'text' => 'Integer Field',
     *     ),
     *   'properties.simpleTypes.entityPicker' => array(
     *         'path'    => 'properties.simpleTypes.entityPicker',
     *         'type'    => 'entityPicker',
     *         'text'    => 'Community based picker',
     *         'apiName' => 'communityBased'
     *     )
     * )
     *
     * @iwAuthorized in entity classes
     */
    public function getEntityAttributesFiltered($entity, $usage, $paths) {
        // validation begin
        $validate = IW_Core_Validate::getInstance();
        $validate
            ->validEnum($usage, 'IW\Core\Attribute\Enum\Usage', 'usage');

        // Entities can contain string from enum or dynamic entities, e.g: DYNAMIC_ENTITY.allTypes
        $this->_validateEntities(array($entity));

        $validate->checkValid();
        // validation end

        $options = array(
            OptionsKeys::LANG => IW_Core_Context::getInstance()->getLanguage()
        );

        if ($this->_isEntityType($entity, Entity::DYNAMIC_ENTITY)) {
            $apiName = $this->_getApiNameFromDynamicEntityType($entity);

            $entityVo = EntityFactory::createEntityForAttributes(
                Entity::DYNAMIC_ENTITY,
                $usage,
                $options
            );

            $entityVo->setApiName($apiName);

            $result = $entityVo->getAttributesFiltered($paths);
        } else {
            $entityVo = EntityFactory::createEntityForAttributes($entity, $usage, $options);
            $result   = $entityVo->getAttributesFiltered($paths);
        }

        return $result;
    }

    /**
     * Returns values for given selectors (supports multiple entities)
     *
     * @param array $selectors   Array of attribute selectors, i.e.:
     *                           array('INITIATOR.FULL_NAME', 'DOCUMENT.AUTHOR.ID', ...))
     *                           When you ask for bad selector (.SOMETHING) or unknow attribute (USER.hu)
     *                           it will be marked as error selector (no exception is thrown)
     * @param Usage $usage       Usage of the values (scenario for which are the values are the values generated)
     * @param array $identifiers Entity identifiers in array where keys are Entity instance
     *                           names and value is identifier e.g. array('INITIATOR'=>1, 'OWNER'=>5)
     *                           see: \IW\Core\Attribute\Entity\[entity]\Enum\Instances
     * @param array $options     Array of options which are used for values generation Keys of this array are
     *                           defined in \IW\Core\Attribute\Enum\OptionsKeys
     *                           Info: User and Article need OptionsKeys::LANG
     *
     * @return ValuesResult
     *          ->getValues():
     *               AttributeValue[] Array of values with keys as selectors. Example:
     *               array(
     *                   'DOCUMENT.NAME' => AttributeValue('NAME', 'bla bla bla', ...),
     *                   'DOCUMENT.COMMUNITIES' => AttributeValue('COMMUNITY', array(0,1,2,3), ...),
     *                   'DOCUMENT.AUTHOR.FULL_NAME' => AttributeValue('FULL_NAME', 'pepik frantik', ...)
     *                   'INITIATOR.FULL_NAME' => AttributeValue('FULL_NAME', 'Ona Doma', ...)
     *                   'ARTICLE.ID' => AttributeValue('ID', 124, ...)
     *               )
     *          ->isOk(): TRUE when all wanted selectors exists in the result, FALSE when some is missing
     *          ->getErrorSelectors(): Array of selectors which are missing in the result
     *
     * @iwAuthorized in entity classes
     */
    public function getValues($selectors, $usage, $identifiers=array(), $options=array()) {
        // validation start
        IW_Core_Validate::getInstance()
            ->validEnum($usage, 'IW\Core\Attribute\Enum\Usage')
            ->validKeysInArray($options, OptionsKeys::getConstants()) // $options values are validated by entities which
                                                                      // use particular options values
            ->checkValid();
        // validation end

        // init
        $result = array();

        // group selectors by entity instance name
        $selectorsSeparated = $this->_separateSelectorsByFirstPart($selectors);

        // get values for each entity instance
        foreach ($selectorsSeparated as $entityInstanceName => $entitySelectors) {
            $entityInstanceName = InstanceHelper::transformEntityInstanceName($entityInstanceName);

            $identifier = isset($identifiers[$entityInstanceName]) ? $identifiers[$entityInstanceName] : null;

            try {
                $entity = EntityFactory::createEntityForValues(
                    $entityInstanceName, $usage, $identifier, $entitySelectors, $options
                );
            } catch (IW_Core_Validate_Exception $e) {
                IW_Core_Log::getLogger($this)->warning('Invalid instance=%s, skipped.', array($entityInstanceName), $e);
                continue;
            }

            // check proper identifier and if it's not corrent then skip getting values
            if ($entity->isIdentifierMandatory() && $identifier === null) {
                IW_Core_Log::getLogger($this)->error(
                    'Identifier is mandatory for instance=%s and was not provided.',
                    array($entityInstanceName)
                );

                // don't call getValues() on the entity object
                continue;
            }

            try {
                // add values of the entity to the final result
                $result += $entity->getValues();
            } catch (IW_Core_Authorization_Exception $exc) {
                IW_Core_Log::getLogger($this)->warning(
                    'Instance=%s with id=%s skipped because of authorization exception.',
                    array($entityInstanceName, $identifier),
                    $exc
                );
            } catch (IW_Core_NotFoundException $exc) {
                IW_Core_Log::getLogger($this)->warning(
                    'Instance=%s with id=%s skipped because of not found exception.',
                    array($entityInstanceName, $identifier),
                    $exc
                );
            }
        }

        // check if all wanted selectors exists in the result
        // use array_value to return only different values, otherwise associated "derave pole" is returned
        $selectorsDiff = array_values(array_diff($selectors, array_keys($result)));
        $resultOk      = !(bool)count($selectorsDiff);

        return new ValuesResult($result, $resultOk, $selectorsDiff);
    }

     /**
     * It loads subentities into structure.
     * It works with reference to structure in parameter.
     *
     * @param array $structure Structure of attributes
     * @param array $entities  List of entities (VOs) for loading subentities
     * @param Usage $usage     value from enum IW\Core\Attribute\Enum\Usage
     * @param array $options   Array of options (Lang, etc.)
     *
     * @return array
     */
    private function _loadSubEntities(&$structure, $entities, $usage, $options) {
        $subEntityTypes = $this->_getReferencedTypes($entities);
        $modelService   = ModelService::getInstance();

        $newEntities = array();
        foreach ($subEntityTypes as $entityType => $entityNames) {
            foreach ($entityNames as $entityName) {
                if ($entityType === Entity::DYNAMIC_ENTITY) {
                    if (!$modelService->isVisibleModel($entityName)) {
                        continue;
                    }

                    if (array_key_exists($entityName, $structure[Entity::DYNAMIC_ENTITY])) {
                        continue;
                    }

                    $entityVo = EntityFactory::createEntityForAttributes(
                        Entity::DYNAMIC_ENTITY,
                        $usage,
                        $options
                    );
                    $entityVo->setApiName($entityName);
                    $structure[Entity::DYNAMIC_ENTITY][$entityName] = $entityVo->getAttributes();
                    $newEntities[]                                  = $entityVo;
                } else {
                    if (array_key_exists($entityName, $structure)) {
                        continue;
                    }

                    $entityVo = EntityFactory::createEntityForAttributes(
                        $entityType,
                        $usage,
                        $options
                    );

                    $structure[$entityType] = $entityVo->getAttributes();
                    $newEntities[]          = $entityVo;
                }
            }
        }

        if (!empty($newEntities)) {
            $this->_loadSubEntities($structure, $newEntities, $usage, $options);
        }

        return $structure;
    }

    /**
     * Create groups of selectors which are devided by the selector first party (entity instance name)
     *
     * Invalid selectors are dropped.
     *
     * @param array $selectors Array with selectors as values
     *
     * @return array Associative array where keys are entity instance names and values are sub-arrays with selectors
     *  Example:
     *  array(
     *      'INITIATOR' => array('INITIATOR.ID', 'INITIATOR.NAME')
     *      'OWNER'     => array('OWNER.FULL_NAME', 'OWNER.ZID_21')
     *  )
     */
    private function _separateSelectorsByFirstPart($selectors) {
        $selectorsSeparated = array();

        // create array of selectors separated by instance name
        foreach ($selectors as $selector) {
            // make sure that selector is valid before working with it
            if (IW_Core_Validate::getInstance()->valid(new SelectorValidator(), $selector)->isValid(true)) {
                $selectorsSeparated[SelectorHelper::getFirstSelectorPart($selector)][] = $selector;
            } else {
                IW_Core_Log::getLogger($this)->warning('Invalid selector=%s skipped.', array($selector));
            }
        }

        return $selectorsSeparated;
    }

    /**
     * Method for validation of provided entities.
     * It performs only validation of attributes, not e.g. existence of apiName.
     *
     * @param array $entities Requested entity types, e.g ['USER', 'DYNAMIC_ENTITY.allTypes']
     *
     * @return void
     */
    private function _validateEntities($entities) {
        $validate = IW_Core_Validate::getInstance();

        // This is here to propagate validation exception.
        $validate->validArray($entities, 'entities');

        // No additional validation is needed. Entities are not array.
        if (!is_array($entities)) {
            return;
        }

        foreach ($entities as $entityName) {
            // Dynamic entities has entityName composed from 2 string concatenated with .
            $entityNameChains = explode('.', $entityName);

            if (count($entityNameChains) == 2) {
                $validate
                    ->validEnum($entityNameChains[0], 'IW\Core\Attribute\Enum\Entity')
                    ->validNotEmpty($entityNameChains[1]);
            } else {
                $validate->validEnum($entityName, 'IW\Core\Attribute\Enum\Entity');
            }
        }
    }

    /**
     * Getting referenced entities from parent entity.
     *
     * @param array $entities Entities, that will be analysed for having references
     *
     * @return array
     */
    private function _getReferencedTypes ($entities) {
        $referencedEntityTypes = [];

        foreach ($entities as $entity) {
            /* @var $entity AbstractEntity */
            $subEntities = $entity->getReferences();

            foreach ((array)$subEntities as $entityType => $entityNames) {
                $referencedEntityTypes[$entityType] = array_key_exists($entityType, $referencedEntityTypes)
                    ? $referencedEntityTypes[$entityType] : array(); // init array

                $referencedEntityTypes[$entityType] += (array)$entityNames;
                $referencedEntityTypes[$entityType]  = array_unique($referencedEntityTypes[$entityType]);
            }
        }

        return $referencedEntityTypes;
    }

    /**
     * Checks, if string with entityType is provided type
     *
     * @param string $entityName Entity name
     * @param string $type       Entity type
     *
     * @return boolean
     */
    private function _isEntityType($entityName, $type) {
        $entityChunks = explode('.', $entityName);

        if (count($entityChunks) === 2 && $entityChunks[0] === $type) {
            return true;
        }

        return false;
    }

    /**
     * Returns api name from dynamic entity type name.
     *
     * @param string $entityName Dynamic entity type name
     *
     * @return string Dynamic entity api name
     *
     * @throws \IW_Core_IllegalArgumentException
     */
    private function _getApiNameFromDynamicEntityType($entityName) {
        $entityChunks = explode('.', $entityName);

        if (count($entityChunks) !== 2 || $entityChunks[0] !== Entity::DYNAMIC_ENTITY) {
            throw new \IW_Core_IllegalArgumentException(
                'Requested entity type is not valid. Expected format DYNAMIC_ENTITY.<apiName>, provided: ' . $entityName
            );
        }

        return ($entityChunks[1]);
    }

    /**
     * Returns match name from match name.
     *
     * @param string $matchName Match type name
     *
     * @return string Dynamic entity api name
     *
     * @throws \IW_Core_IllegalArgumentException
     */
    private function _getApiNameFromMatchType($matchName) {
        $entityChunks = explode('.', $matchName);

        if (count($entityChunks) !== 2 || $entityChunks[0] !== Entity::MATCH) {
            throw new \IW_Core_IllegalArgumentException(
                'Requested entity type is not valid. Expected format MATCH.<matchname>, provided: ' . $matchName
            );
        }

        return ($entityChunks[1]);
    }
}
