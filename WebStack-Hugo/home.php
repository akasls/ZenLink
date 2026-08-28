<?php 

//文章模板
define('wz_template','
<div class="wz-card io-px-2 col-6 col-md-4 col-xl-3 col-xxl-6a py-2 py-md-3" id="w{id}">
    <div class="card-post list-item">
        <div class="media media-4x3 p-0 rounded"><a class="media-content" href="{url}" style="background-image: url({ico});"></a></div>
        <div class="list-content">
            <div class="list-body"><a href="{url}" class="list-title text-md overflowClip_2">{title}</a></div>
        </div>
    </div>
</div>');

//链接模板
define('link_template','<div class="url-card col-6 col-sm-6 col-md-4 col-xl-5a col-xxl-6a" id="l{id}">
    <div class="url-body default">
        <a href="{url}" target="{target}" data-url="{url}" class="card no-c mb-4" {tip} >
            <div class="card-body">
                <div class="url-content d-flex align-items-center">
                    <div class="url-img mr-2 d-flex align-items-center justify-content-center"><img class="lazy" {lazyload}="{ico}"></div>
                    <div class="url-info flex-fill">
                        <div class="text-sm overflowClip_1"><strong>{title}</strong></div>'.
                        ($GLOBALS['theme_config']['hide-description'] == 0 ? '<p class="overflowClip_1 m-0 text-muted text-xs">{description}</p>':'').'
                    </div>
                </div>
            </div>
        </a>'.
        ($theme_config['direct_access'] == '1' ? '<a href="{real_url}" class="togo text-center" data-toggle="tooltip" data-placement="right" title="直达" rel="nofollow"><i class="iconfont icon-goto"></i></a>':'').
    '</div>
</div>');
$MIXED_DATA = Get_Data();
function echo_url_card($category) {
    foreach($category['link'] as $link){
        //悬停提示效果
        if($GLOBALS['theme_config']['hover_tip'] == 1 && $GLOBALS['theme_config']['hide-description'] == 0){
            //二维码>描述
            if(isset($link['_QRcode']) && !empty($link['_QRcode'])){
                $link['tip'] = 'data-placement="bottom" data-toggle="tooltip" data-html="true" data-original-title="'."<img src='{$link['_QRcode']}' width='128'>".'"';
            }else{
                $link['tip'] = 'data-placement="bottom" data-toggle="tooltip" data-original-title="'.$link['description'].'"';
            }
        }
        if(in_array($category['category_type'],['wz','wz_top','wz_new'])){
            echo strtr(wz_template, ['{id}' => $link['id'],'{url}' => $link['url'],'{ico}' => $link['ico'],'{title}' => $link['title']]);
        }else{
            echo strtr(link_template, [
                '{id}' => $link['id'],
                '{url}' => $link['url'],
                '{tip}' => $link['tip'],
                '{lazyload}' => $GLOBALS['lazyload'],
                '{ico}' => $link['ico'],
                '{title}' => $link['title'],
                '{description}' => $link['description'],
                '{real_url}' => $link['real_url'],
                '{target}'  => $link['id'] > 0 ? '_blank' : '_self'
            ]);
        }
    }
}

?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge, chrome=1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#f9f9f9" />
    <title><?php echo $site['Title'];?></title>
    <meta name="keywords" content="<?php echo $site['keywords']; ?>" />
    <meta name="description" content="<?php echo $site['description']; ?>">
    <link rel="shortcut icon" href="<?php echo $favicon;?>">
    <?php if($theme_config['admin'] == 1 &&  is_login ){ ?>
    <link rel="stylesheet" type="text/css" href="<?php echo $layui['css']; ?>" />
    <?php }?>
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/iconfont.css" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $libs?>/bootstrap4/css/bootstrap.min.css" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/style-3.03029.1.css?v=<?php echo $theme_ver; ?>" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/custom-style.css?v=<?php echo $theme_ver; ?>" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $libs?>/Font-awesome/4.7.0/css/font-awesome.css">
    <script type="text/javascript" src="<?php echo $libs?>/jquery/jquery-3.6.0.min.js"></script>
    <style><?php
        //字体大小
        echo "body,html{font-size:{$theme_config['font-size']}px!important;}";
        //白天背景
        echo empty($theme_config['bg_img']) ? '':"body{background-size: cover;background-image:url({$theme_config['bg_img']});background-attachment: fixed;}";
        //背景色
        echo in_array($theme_config['bg'],['not','white-bg']) ? '':'.slider_menu[sliderTab] {background: rgb(255 255 255);}';
        //隐藏描述
        echo $theme_config['hide-description'] == 1 ? '.url-card .url-img{width:20px;height:20px;}.url-card .mini a.togo,.url-card .default a.togo{top: 10px;}':'';
    ?></style>
    <?php echo $site['custom_header'].PHP_EOL?>
    <?php echo $global_config['global_header'].PHP_EOL?>
    <?php if(check_purview('header',1)){echo $theme_config['header_code'].PHP_EOL;}?>
</head>
<body class="io-grey-mode">
    <div <?php echo $theme_config['loading'] == 0 ? 'style="display:none;"':''; ?> id="loading">
        <div class="loader"><?php echo $site['Title'];?></div>
    </div>
    <div class="page-container">
	    <!--左侧栏-->
        <div id="sidebar" class="sticky sidebar-nav fade mini-sidebar" style="width: 60px;" data="<?php echo $theme_config['sidebar-nav'] == 1 ? 1 : 0 ;?>">
            <div class="modal-dialog h-100 sidebar-nav-inner">
                <!--头部Logo-->
                <div class="sidebar-logo border-bottom border-color">
                    <div class="logo overflow-hidden">
                        <a href="<?php echo $urls['home']?>" class="logo-expanded">
                            <img src="<?php echo $theme_config['logo_light']?>" height="40" class="logo-light">
                            <img src="<?php echo $theme_config['logo_dark']?>" height="40" class="logo-dark d-none">
                        </a>
                        <a href="<?php echo $urls['home']?>" class="logo-collapsed">
                            <img src="<?php echo $theme_config['logo_collapsed']?>" height="40" class="logo-light">
                            <img src="<?php echo $theme_config['logo_collapsed']?>" height="40" class="logo-dark d-none">
                        </a>
                    </div>
                </div>
                <!--中部分类-->
                <div class="sidebar-menu flex-fill">
                    <div class="sidebar-scroll">
                        <div class="sidebar-menu-inner">
                            <ul><?php foreach ( ($GLOBALS['Mode'] == 'category' ? $categorys_data : $MIXED_DATA)  as $category) { 
                                echo '<li class="sidebar-item">';
                                    echo_category_a($category);
                                    if($category['subitem_count'] > 0){
                                        echo '<ul>';
                                        foreach ($category['subitem'] as $category_sub){
                                            echo '<li>'; echo_category_a($category_sub); echo '</li>';
                                        }
                                        echo '</ul>';
                                    }
                                }
                                echo '</li>';
                            ?></ul>
                        </div>
                    </div>
                </div>
                <!--底部-->
                <div class="border-top py-2 border-color">
                    <div class="flex-bottom">
                        <ul><?php 
                            $template = '<li class="sidebar-item"><a href="%s" target="_blank"><i class="fa %s fa-lg icon-fw icon-lg mr-2"></i><span>%s</span></a></li>';
                            is_guestbook() && printf($template, $urls['guestbook'], 'fa-commenting-o', '在线留言');
                            is_apply() && printf($template, $urls['apply'], 'fa-pencil', '网站提交');
                            admin_inlet() && printf($template, $urls['admin'], 'fa-user', '系统管理'); 
                        ?></ul>
                    </div>
                </div>
            </div>
        </div>
        
        <!--主体内容-->
        <div class="main-content flex-fill <?php echo empty($theme_config['bg_img']) ? $theme_config['bg']:'';?>">
            <div class="big-header-banner">
                <div id="header" class="page-header sticky">
                    
                    <div class="navbar navbar-expand-md">
                        

                        <div class="container-fluid p-0">
                            
                            <!--手机端顶部图标-->
                            <a href="" class="navbar-brand d-md-none">
                                <img src="<?php echo $theme_config['logo_light']?>" class="logo-light">
                                <img src="<?php echo $theme_config['logo_dark']?>" class="logo-dark d-none">
                            </a>
                            
                            <div class="collapse navbar-collapse order-2 order-md-1">
                                
                                <!--分类收缩图标-->
                                <div class="header-mini-btn">
                                    <label>
                                        <input id="mini-button" type="checkbox">
                                        <svg viewbox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path class="line--1" d="M0 40h62c18 0 18-20-17 5L31 55"></path><path class="line--2" d="M0 50h80"></path><path class="line--3" d="M0 60h62c18 0 18 20-17-5L31 45"></path></svg>
                                    </label>
                                </div>
                                <!--顶部链接-->
                                <ul class="navbar-nav site-menu" style="margin-right: 16px;"><?php 
                                    //QQ登录
                                    $theme_config['qq_login'] == '1' && !is_login() && print('<li ><a href="/auth/qq?s=homepage" ><img src="./templates/home/WebStack-Hugo/assets/images/bt_blue_76X24.png"></a></li>');
                                    //管理入口
                                    admin_inlet() && print("<li ><a href=\"./?c=admin&u={$u}\"><i class=\"fa fa-user-circle-o icon-fw mr-2\"></i><span> 管理</span></a></li>");
                                    //导航菜单
                                    foreach(get_nav_menu() as $nav){
                                        $extend = json_decode($nav['extend'],true);
                                        if(empty($extend['nav'])){
                                            echo "<li ><a target=\"{$nav['target']}\" href=\"{$nav['url']}\" title='{$nav['description']}'><i class=\"{$extend['ico']} icon-fw mr-2\"></i><span> {$nav['title']}</span></a></li>";
                                        }else{
                                            echo "<li class=\"menu-item-has-children\"><a style=\"cursor:pointer\" target=\"{$nav['target']}\" title='{$nav['description']}'><i class=\"{$extend['ico']} icon-fw mr-2\"></i><span> {$nav['title']}</span></a><ul>";
                                            foreach($extend['nav'] as $nav2){
                                                echo "<li ><a target=\"{$nav2['target']}\" href=\"{$nav2['url']}\" title='{$nav2['description']}'><i class=\"{$nav2['ico']} icon-fw mr-2\"></i><span> {$nav2['title']}</span></a></li>";
                                            }
                                            echo '</ul></li>';
                                        }
                                    }
                                    ?>
                                </ul>
                            </div><!--left end-->
                            <!--right--> 
                            
                            <ul class="nav navbar-menu text-xs order-1 order-md-2">
<?php if($theme_config['hitokoto'] == 1){?> 
                                <li class="nav-item mr-3 mr-lg-0 d-none d-lg-block">
                                    <div><a href="javascript:void(0);" style="font-size: <?php echo $theme_config['font-size'];?>px;"><?php echo yiyan();?></a></div>
                                </li>
<?php } $theme_config['qq_login'] == '1' && !is_login() && 
                                print('<li class="ml-3 ml-md-4 d-md-none mobile-menu"><a href="/auth/qq?s=homepage" ><i class="iconfont icon-qq icon-2x"></i></a></li>'); ?>
                                <div id="translate"></div>
                                <!--搜索图标-->
                                <li class="nav-search ml-3 ml-md-4">
                                    <a href="javascript:" data-toggle="modal" data-target="#search-modal" class="search-modal">
                                        <i class="iconfont icon-search icon-2x"></i>
                                    </a>
                                </li>
                                <!--菜单图标-->
                                <li class="nav-item d-md-none mobile-menu ml-3 ml-md-4">
                                    <a href="javascript:" id="sidebar-switch" data-toggle="modal" data-target="#sidebar">
                                        <i class="iconfont icon-classification icon-2x"></i>
                                    </a>
                                </li>
                            </ul><!--right end--> 
                        </div>
                    </div>
                </div>
                <div class="placeholder" style="height:74px"></div>
            </div>
<?php if($theme_config['search-bg'] == 1){ require 'search-bg.php';} ?>
            <div id="content" class="content-site customize-site">
                <div class="flex-fill screen" style="display: none">
                    <h4 class="text-gray text-lg mb-4">
                        <i class="fa fa-search icon-fw mr-2" id="search_bookmark"></i>站内搜索  
                    </h4>
                    <div class="row" id="screen_flex">
                        
                    </div>
                </div>
                <div class="row screen" id="screen_result" style="display: none"></div>
                
                <?php if($global_config['site_ad'] == '1'){ echo '<div style="margin-bottom: 10px;">';echo_site_ad(); echo '</div>';}?>
                
                
                <?php if( $GLOBALS['hot_news_config']['mode'] > 0  && !isset($_GET['cid'])){?>
                <div class="flex-fill" style="padding-bottom: 10px;">
                    <h4 class="text-gray text-lg mb-4" id="hot_news">
                        <i class="fa fa-bullhorn icon-fw mr-2"></i>热点新闻
                    </h4>
                    <div class="flex-fill"><div id="lytoday"><?php echo $GLOBALS['hot_news_config']['mode'] == '1' ? hot_get_html() : ''; ?></div></div>
                </div>
                <?php } ?> 
<?php
    foreach($MIXED_DATA as $category){
        $sortable = $category['category_type'] == 'link' ? 'sortable' : '';
        $property = $category['property'] == 1 ? $property = '<i class="fa fa-lock" style="color:#5FB878"></i>':'';
        $icon = empty($category['icon']) ? "<i class=\"{$category['font_icon']} fa-lg icon-fw icon-lg mr-2\"></i>" : '<img class="icon" src="' . get_category_icon($category['icon']) . '">';
        //$more_link = $GLOBALS['Mode'] == 'home' && $category['more'] == true ? "<a class='btn-move text-xs' href='{$category['category_url']}'>more+</a>" : '';
        $more_link = '';
        echo "<div class=\"d-flex flex-fill\" id=\"category-{$category['id']}\"><h4 class=\"text-gray text-lg mb-4\">{$icon} {$category['name']} {$property}</h4><div class=\"flex-fill\"></div>{$more_link}</div>";
        //存在二级分类时显示tab
        if($category['subitem_count'] > 0){
            //根据主题配置决定是否在tab中显示一级分类
            if($theme_config['hide-category'] == 0 || ( $theme_config['hide-category'] == 1 && $category['link_count'] + $category['wz_count'] > 0)){
                array_unshift($category['subitem'],$category);
            }
            //渲染tab
            echo '<div class="d-flex flex-fill flex-tab align-items-center"><div class="overflow-x-auto slider_menu mini_tab" slidertab="sliderTab"><ul class="nav nav-pills menu" role="tablist">';
            foreach ($category['subitem'] as $key => $tab){
                $active = $key == 0 ? 'active':'';
                $tab_more = $tab['more'] == true ? '1':'0';
                echo "<li class=\"pagenumber nav-item\" data-id=\"{$tab['id']}\" more='{$tab_more}'><a id=\"category-{$tab['id']}\" class=\"nav-link {$active}\" data-toggle=\"pill\" href=\"#tab-{$tab['id']}\" >{$tab['name']}</a></li>";
            }
            
            echo "</div><div class='flex-fill'></div>  </div>";
            //渲染链接框架
            echo '<div class="tab-content mt-4">';
            $tab_i = 0;
            foreach ($category['subitem'] as $key => $tab){
                $tab_i ++;
                $active = $key == 0 ? 'active':'';
                $is_echo = $theme_config['dynamic_load'] == '0' || !in_array($tab['category_type'],['link','wz']) || ($theme_config['dynamic_load'] == '1' && $tab_i === 1 ) ? '1' : '0';
                
                echo "<div id=\"tab-{$tab['id']}\" class=\"tab-pane {$active}\" load=\"{$is_echo}\">";
                echo "<div class=\"row {$sortable} row-{$tab['id']}\" id=\"{$tab['id']}\">";
                if($is_echo == '1'){
                    echo_url_card($tab);
                }
                echo '</div></div>';

            }
            echo '</div>';
        //一级分类显示
        }else{
            echo "<div class=\"row {$sortable}\" id=\"{$category['id']}\">";
            echo_url_card($category);
            echo '</div>';
        }
        echo '<br />';
    }
?>
<?php $friend_link = get_friend_link(); if(!empty($friend_link)){ ?>
                <h4 class="text-gray text-lg mb-4"><i class="iconfont icon-book-mark-line icon-lg mr-2" id="friendlink"></i>友情链接</h4>
                <div class="friendlink text-xs card">
                    <div class="card-body">
                    <?php 
                        foreach($friend_link as $link){
                            echo "<a href=\"{$link['url']}\" title=\"{$link['description']}\" target=\"_blank\">{$link['title']}</a>";
                        }
                    ?>
                    </div>
                </div>
<?php } ?>
            </div>
            <footer class="main-footer footer-type-1 text-xs">
                <div id="footer-tools" class="d-flex flex-column">
                    <a href="javascript:" id="to-up" class="btn rounded-circle go-up m-1" data-toggle="tooltip" data-placement="left" title="返回顶部">
                        <i class="iconfont icon-to-up"></i>
                    </a> 
<?php if($theme_config['admin'] == 1 &&  is_login ){ ?> 
		            <a href="javascript:" id="addUrl" class="btn rounded-circle m-1" data-toggle="tooltip" data-placement="left" title="添加链接">
                        <i class="iconfont icon-add"></i>
                    </a>
<?php } ?> 
                    <a href="javascript:" data-toggle="modal" data-target="#search-modal" class="btn rounded-circle m-1 search-modal" rel="search" one-link-mark="yes" title="聚合搜索">
                        <i class="iconfont icon-search"></i>
                    </a>
		            <a href="javascript:" id="NightMode" data="<?php echo $theme_config['NightMode'];?>" class="btn rounded-circle switch-dark-mode m-1" data-toggle="tooltip" data-placement="left" title="日间模式">
                        <i class="iconfont mode-ico"></i>
                    </a>
                </div>
                <div class="footer-inner">
                    <div class="footer-text">
                        <?php echo $copyright.PHP_EOL;?>
                        <?php echo $ICP.PHP_EOL;?>
                        <?php echo $site['custom_footer'].PHP_EOL;?>
                        <?php echo $global_config['global_footer'].PHP_EOL;?>
                    </div>
                </div>
            </footer>
        </div>
    </div>
    <script>var u = "<?php echo U;?>";var config = <?php echo json_encode($js_config)?></script>
<?php if($GLOBALS['hot_news_config']['mode'] == '2' && !isset($_GET['cid'])){ ?>
    <script type='text/javascript' src="./?hot=<?php echo $GLOBALS['hot_news_config']['template'];?>&u=<?php echo U;?>&t=<?php echo time();?>"></script>
<?php } ?> 
<?php if($theme_config['translate_sw'] == 1){ //翻译插件 ?> 
    <script type='text/javascript' src='<?php echo $theme_dir?>/assets/js/translate.js'></script>
<?php } ?> 
<?php if($theme_config['search-modal'] == 1){ require 'search-modal.php';}?>
<?php if($theme_config['admin'] == 1 &&  is_login ){ ?> 
    <script src="<?php echo $libs?>/Other/ClipBoard.min.js"></script>
    <script src="<?php echo $layui['js']; ?>" type="text/javascript" charset="utf-8"></script>
    <?php if($theme_config['sort'] == 1 ){ ?> 
    <script src="<?php echo $theme_dir?>/assets/js/jquery-ui.min.js?v=<?php echo $theme_ver; ?>" type="text/javascript" charset="utf-8"></script>
    <?php } ?> 
    <script src="<?php echo $theme_dir?>/assets/js/admin.js?v=<?php echo $theme_ver; ?>" type="text/javascript" charset="utf-8"></script>
<?php } ?> 
<?php if($theme_config['hover_tip'] == 1){ //悬停提示 ?> 
    <script type='text/javascript' src='<?php echo $theme_dir?>/assets/js/popper.min.js'></script>
<?php } ?> 
    <script type='text/javascript' src='<?php echo $libs?>/bootstrap4/js/bootstrap.min.js'></script>
<?php if($theme_config['lazyload'] == 1){ //延迟加载 ?> 
    <script type='text/javascript' src='<?php echo $theme_dir?>/assets/js/lazyload.min-12.4.0.js'></script>
<?php } ?> 
    <script type='text/javascript' src='<?php echo $theme_dir?>/assets/js/app-mini.js?v=<?php echo $theme_ver; ?>'></script>

</body>
</html>