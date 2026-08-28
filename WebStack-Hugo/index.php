<?php 
if (preg_match('/MSIE|Trident/', $_SERVER['HTTP_USER_AGENT'])) {
    exit("<h2>您的浏览器过于老旧、请使用现代浏览器访问本网站。</h2><h3>国产浏览器请切换到极速模式</h3>");
}
if($c == 'click' || $c == 'article'){
    //主题配置(用户)
    $theme_config_db = get_db('user_config','v',['t'=>'theme_home','k'=>'WebStack-Hugo','uid'=>UID]);
    $theme_config_db = unserialize($theme_config_db);
    //合并配置数据
    $theme_config = empty($theme_config_db) ? $theme_config : array_merge ($theme_config,$theme_config_db);
}

$lazyload = $theme_config['lazyload'] == 1 ? 'data-src':'src';
$theme_config['logo_light'] = empty($theme_config['logo_light']) ? "{$theme_dir}/assets/images/bt8-expand-light.png" : $theme_config['logo_light'];
$theme_config['logo_dark'] = empty($theme_config['logo_dark']) ? "{$theme_dir}/assets/images/bt8-expand-dark.png" : $theme_config['logo_dark'];
$theme_config['logo_collapsed'] = empty($theme_config['logo_collapsed']) ? "{$theme_dir}/assets/images/bt.png" : $theme_config['logo_collapsed'];
$link_extend = $global_config['link_extend'] && check_purview('link_extend',1);
$js_config['bg_img'] = $theme_config['bg_img'];$js_config['bg_img_night'] = $theme_config['bg_img_night'];
$js_config['tooltip'] = $theme_config['hover_tip'] == 1;
$js_config['zhida'] = $theme_config['direct_access'] == 1;
$js_config['hide_description'] = $theme_config['hide-description'] == 1;
$js_config['load_sort'] = $theme_config['sort'] == 1;
$js_config['admin'] = is_login && $theme_config['admin'] == 1;
$js_config['search_bookmark'] = intval($theme_config['search_bookmark']);
//自动翻译配置
$js_config['translate_sw'] = intval($theme_config['translate_sw']);
if( $js_config['translate_sw'] == 1){
    $js_config['locale_lang'] = intval($theme_config['locale_lang']);
    $js_config['translate_select'] = intval($theme_config['translate_select']);
    $js_config['languages'] = $theme_config['languages'];
    $js_config['translate_service'] = intval($theme_config['translate_service']);
}



if($c == 'click'){
    $js_config['admin'] = false;
    require 'transit.php';
}elseif($_GET['method'] === 'search'){
    require 'search.php';
}elseif($c == 'article'){ 
    require 'article.php';
}else{
    require 'home.php';
}

//左侧分类A标签
function echo_category_a($category){ 
    $icon = empty($category['icon']) ? "<i class=\"{$category['font_icon']} fa-lg icon-fw icon-lg mr-2\"></i>" : '<img class="icon" src="' . get_category_icon($category['icon']) . '">';
    $more = $category['subitem_count'] > 0 ? '<i class="iconfont icon-arrow-r-m sidebar-more text-sm"></i>' : '';
    echo "<a href=\"{$GLOBALS['urls']['home2']}#category-{$category['id']}\" class=\"smooth\">{$icon}<span>{$category['name']}</span>{$more}</a>";
}
