<?php

namespace luckyturn\craftblockboard\web\assets\blockboard;

use Craft;
use craft\web\AssetBundle;
use craft\web\assets\cp\CpAsset;

/**
 * Block Board asset bundle
 */
class BlockBoardAsset extends AssetBundle
{
    public $sourcePath = __DIR__ . '/dist';
    public $depends = [CpAsset::class];
    public $js = ['blockboard.js'];
    public $css = ['blockboard.css'];
}
