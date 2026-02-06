<?php

namespace luckyturn\craftblockboard;

use Craft;
use craft\base\Model;
use craft\base\Plugin;
use craft\helpers\FileHelper;
use craft\web\View;
use luckyturn\craftblockboard\models\Settings;
use luckyturn\craftblockboard\web\assets\blockboard\BlockBoardAsset;
use yii\base\Event;
use craft\events\TemplateEvent;
use yii\helpers\Json;
use yii\base\InvalidConfigException;

/**
 * Block Board plugin
 *
 * @method static BlockBoard getInstance()
 * @method Settings getSettings()
 */
class BlockBoard extends Plugin
{
    public string $schemaVersion = '1.0.0';
    public bool $hasCpSettings = true;

    public static function config(): array
    {
        return [
            'components' => [
                // Define component configs here...
            ],
        ];
    }

    public function init(): void
    {
        parent::init();

        $this->attachEventHandlers();

        // Any code that creates an element query or loads Twig should be deferred until
        // after Craft is fully initialized, to avoid conflicts with other plugins/modules
        Craft::$app->onInit(function() {
            // ...
        });
    }

    public function afterInstall(): void
    {
        parent::afterInstall();

        $sourcePath = $this->getBasePath() . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'blockboard.php';
        $targetPath = Craft::getAlias('@config/blockboard.php');

        if (!file_exists($sourcePath)) {
            Craft::warning('BlockBoard config source file not found: ' . $sourcePath, __METHOD__);
            return;
        }

        if (file_exists($targetPath)) {
            return;
        }

        FileHelper::createDirectory(dirname($targetPath));
        copy($sourcePath, $targetPath);
    }

    protected function createSettingsModel(): ?Model
    {
        return Craft::createObject(Settings::class);
    }

    protected function settingsHtml(): ?string
    {
        return Craft::$app->view->renderTemplate('_block-board/_settings.twig', [
            'plugin' => $this,
            'settings' => $this->getSettings(),
        ]);
    }

    private function attachEventHandlers(): void
    {
        if (!Craft::$app->getRequest()->getIsCpRequest()) {
            return;
        }

        // Matrix Field Preview R.I.P. Enter -> LTM Matrix Block Previews
        // Load CSS/JS before page template is rendered
        Event::on(
            View::class,
            View::EVENT_BEFORE_RENDER_TEMPLATE,
            function (TemplateEvent $event) {
                try {
                    $blockBoardPreviewConfig = Craft::$app->getConfig()->getConfigFromFile('blockboard');
                    $isEnabled = (bool)($blockBoardPreviewConfig['enabled'] ?? true);
                    if (!$isEnabled) {
                        return;
                    }

                    $fieldsToPreview = $blockBoardPreviewConfig['fieldsToPreview'] ?? [];
                    if (!is_array($fieldsToPreview)) {
                        $fieldsToPreview = [];
                    }
                    $fieldsToPreview = array_values(array_filter($fieldsToPreview, function($fieldHandle) {
                        return is_string($fieldHandle) && trim($fieldHandle) !== '';
                    }));
                    $locationOfPreviewImages = $blockBoardPreviewConfig['locationOfPreviewImages'] ?? ['*' => 'blockboard/previews'];
                    if (is_string($locationOfPreviewImages)) {
                        $locationOfPreviewImages = ['*' => $locationOfPreviewImages];
                    }
                    if (!is_array($locationOfPreviewImages)) {
                        $locationOfPreviewImages = ['*' => 'blockboard/previews'];
                    }
                    $locationOfPreviewImages = array_filter($locationOfPreviewImages, function($path, $key) {
                        return is_string($key) && is_string($path) && trim($path) !== '';
                    }, ARRAY_FILTER_USE_BOTH);
                    if (!isset($locationOfPreviewImages['*'])) {
                        $locationOfPreviewImages['*'] = 'blockboard/previews';
                    }

                    Craft::$app->getView()->registerJs(
                        'window.blockBoardPreviewFields = ' . Json::encode($fieldsToPreview) . ';',
                        View::POS_HEAD
                    );
                    Craft::$app->getView()->registerJs(
                        'window.blockBoardPreviewImageLocations = ' . Json::encode($locationOfPreviewImages) . ';',
                        View::POS_HEAD
                    );
                    Craft::$app->getView()->registerAssetBundle(BlockBoardAsset::class);
                } catch (InvalidConfigException $e) {
                    Craft::error(
                        'Error registering AssetBundle - '.$e->getMessage(),
                        __METHOD__
                    );
                }
            }
        );
    }
}
