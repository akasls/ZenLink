<?php  
$lazyload = $theme_config['lazyload'] == 1 ? 'data-src':'src';
$content = ['cid(id)','name','property','font_icon','icon','description'];
unset($where);
$where['uid'] = UID; 
$where['fid'] = 0;
$where['status'] = 1;
$where['ORDER'] = ['weight'=>'ASC'];
$category_parent = select_db('user_categorys',$content,$where);
$link['category'] = get_db('user_categorys','*',['uid'=>UID,'cid'=>$link['fid']]);
if($theme_config['shot'] == '1'){
    $shot_url = "https://mini.s-shot.ru/?{$link['url']}";
}elseif($theme_config['shot'] == '2'){
    $shot_url = "https://s0.wp.com/mshots/v1/{$link['url']}";
}else{
    $shot_url = geticourl($site['link_icon'],$link);;
}

?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge, chrome=1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#f9f9f9" />
    <title><?php echo $link['title']; ?></title>
    <meta name="keywords" content="<?php echo $link['keywords']?>" />
    <meta name="description" content="<?php echo $link['description']; ?>">
    <link rel="shortcut icon" href="<?php echo $favicon;?>">
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/iconfont.css" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $libs?>/bootstrap4/css/bootstrap.min.css" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/style-3.03029.1.css?v=<?php echo $theme_ver; ?>" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/custom-style.css?v=<?php echo $theme_ver; ?>" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $libs?>/Font-awesome/4.7.0/css/font-awesome.css">
    <script type="text/javascript" src="<?php echo $libs?>/jquery/jquery-3.6.0.min.js"></script>
    <script type="text/javascript" src="<?php echo $libs; ?>/jquery/jquery.qrcode.min.js"></script>
    <style><?php
        //字体大小
        echo "body,html{font-size:{$theme_config['font-size']}px!important;}";
        //白天背景
        echo empty($theme_config['bg_img']) ? '':"body{background-size: cover;background-image:url({$theme_config['bg_img']});background-attachment: fixed;}";
        //背景色
        echo in_array($theme_config['bg'],['not','white-bg']) ? '':'.slider_menu[sliderTab] {background: rgb(255 255 255);}';
    ?>
    </style>
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
                            <ul><?php foreach ( Get_Data( ['Mode' => 'categorys_data'] )  as $category) { 
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
        <div class="main-content flex-fill <?php echo $theme_config['bg'];?>">
            <div class="big-header-banner">
                <div id="header" class="page-header sticky">
                    <div class="navbar navbar-expand-md">
                        <div class="container-fluid p-0">
                            <!--手机端顶部图标-->
                            <a href="" class="navbar-brand d-md-none">
                                <img src="<?php echo $theme_config['logo_collapsed']?>" class="logo-light">
                                <img src="<?php echo $theme_config['logo_collapsed']?>" class="logo-dark d-none">
                            </a>
                            
                            <div class="collapse navbar-collapse order-2 order-md-1">
                                <!--分类收缩图标-->
                                <div class="header-mini-btn">
                                    <label>
                                        <input id="mini-button" type="checkbox">
                                        <svg viewbox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                            <path class="line--1" d="M0 40h62c18 0 18-20-17 5L31 55"></path>
                                            <path class="line--2" d="M0 50h80"></path>
                                            <path class="line--3" d="M0 60h62c18 0 18 20-17-5L31 45"></path>
                                        </svg>
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
                                        $nav_extend = json_decode($nav['extend'],true);
                                        if(empty($nav_extend['nav'])){
                                            echo "<li ><a target=\"{$nav['target']}\" href=\"{$nav['url']}\" title='{$nav['description']}'><i class=\"{$nav_extend['ico']} icon-fw mr-2\"></i><span> {$nav['title']}</span></a></li>";
                                        }else{
                                            echo "<li class=\"menu-item-has-children\"><a style=\"cursor:pointer\" target=\"{$nav['target']}\" title='{$nav['description']}'><i class=\"{$nav_extend['ico']} icon-fw mr-2\"></i><span> {$nav['title']}</span></a><ul>";
                                            foreach($nav_extend['nav'] as $nav2){
                                                echo "<li ><a target=\"{$nav2['target']}\" href=\"{$nav2['url']}\" title='{$nav2['description']}'><i class=\"{$nav2['ico']} icon-fw mr-2\"></i><span> {$nav2['title']}</span></a></li>";
                                            }
                                            echo '</ul></li>';
                                        }
                                    }
                                    ?>
                                </ul><!--nav end-->
                            </div><!--left end-->
                            <!--right--> 
                            <ul class="nav navbar-menu text-xs order-1 order-md-2">
<?php if($theme_config['hitokoto'] == 1){?> 
                                <li class="nav-item mr-3 mr-lg-0 d-none d-lg-block">
                                    <div><a href="javascript:void(0);" style="font-size: <?php echo $theme_config['font-size'];?>px;"><?php echo yiyan();?></a></div>
                                </li>
<?php } ?> 
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

			<div id="content" class="container user-area my-4"> 
                <div class="flex-fill screen" style="display: none">
                    <h4 class="text-gray text-lg mb-4">
                        <i class="fa fa-search icon-fw mr-2" id="search_bookmark" data-type="transit"></i>站内搜索  
                    </h4>
                    <div class="row" id="screen_flex">
                        
                    </div>
                </div>
                <div class="row screen" id="screen_result" style="display: none"></div>
			
                <div class="card">
                    <div class="card-body">
                        <div class="text-lg pb-3 border-bottom border-light border-2w mb-3">
                            <a target="_blank" href="<?php echo $link['url'];?>" title="<?php echo $link['title'];?>"><?php echo $link['title'];?></a>
                        </div>  
                        <div class="empty-content text-center pb-5">
                            <div class="site-introduce">
                            	<p><?php echo $link['description'];?></p>
                            	<p class="site-snapshot">
                            		<img class="site-image" src="<?php echo $theme_dir?>/assets/images/loading.gif" data-src="<?php echo $shot_url;?>"  title="<?php echo $link['title'];?>">
                            	</p>
                            	<p class="site-form">
                            		<span>网站域名：<?php echo parse_url($link['url'])['host']?></span>
                            		<span>更新日期：<?php echo date('Y-m-d', $link['up_time']);?></span>
                            		<span>网站简称：<?php echo $link['title'];?></span>
                            		<span>网站分类：<?php echo $link['category']['name'];?></span>
                            		<span>人气指数：<?php echo $link['click'];?></span>
<?php 
if($global_config['link_extend'] == 1 && check_purview('link_extend',1)){
    $list = get_db("user_config","v",["k"=>"s_extend_list","uid"=>UID]);
    if(!empty($list)){
        $list = unserialize($list);
        foreach ($list as $data) {
            if($data['type'] == 'editor'){$editor_data = $extend["_{$data['name']}"] ?? $data['default']; continue;}
            if($data['name'] == 'QRcode' || $data['type'] != 'text' || strlen($extend["_{$data['name']}"]) == 0){continue;}
            $name = "_{$data['name']}";
            $value = isset($extend[$name]) ? $extend[$name] : $data['default'];
            echo "<span>{$data['title']}：{$value}</span>";
        }
    }
}
$category_url = static_link ? "$HOST/category-{$UUID}-{$link['category']['cid']}.html":"./?u={$u}&cid={$link['category']['cid']}";
?>

<?php 
$i = 0;
foreach ($link['url_standby'] as $key => $url_standby){
    $i++;
    if(preg_match('/\[(.*?)\]\((.*?)\)/', $url_standby, $match)){
        $title = $match[1];
        $url = $match[2];
    }else{
        $title = $url_standby;
        $url = $url_standby;
    }
    ?>
    <span><a href="<?php echo $url; ?>" rel = "nofollow" title = "<?php echo $title == $url ? "备用链接{$i}": $title; ?>"><?php echo $title == $url ? "备用链接{$i}": $title; ?></a></span>
<?php } ?>
                            	</p>
                            	<div class="site-road">
                            		<p class="site-road-start">
                            			<span class="site-arrive">
                            				<a rel="nofollow" href="<?php echo $link['url'];?>">进入网站</a>
                            			</span>
                            			<span class="site-similar">
                            				<a rel="nofollow" href="<?php echo $category_url;?>">同类网站</a>
                            			</span>
                            		</p>
                            	</div>
                            	<?php if(isset($editor_data)){
                            	    echo '<style>.link_content img {max-width: 100%;}</style>';
                            	    echo '<div class="link_content" style="margin-top: 20px;">'.$editor_data.'</div>';
                            	}?>
                            </div>
                        </div>
                    </div>
                    
                </div>
	        </div>
            <footer class="main-footer footer-type-1 text-xs">
                <div id="footer-tools" class="d-flex flex-column">
                    <a href="javascript:" id="to-up" class="btn rounded-circle go-up m-1" data-toggle="tooltip" data-placement="left" title="返回顶部">
                        <i class="iconfont icon-to-up"></i>
                    </a>
                    <a href="javascript:" data-toggle="modal" data-target="#search-modal" class="btn rounded-circle m-1 search-modal" rel="search" one-link-mark="yes" title="聚合搜索">
                        <i class="iconfont icon-search"></i>
                    </a>
		            <a href="javascript:" id="NightMode" data="<?php echo $theme_config['NightMode'];?>" class="btn rounded-circle switch-dark-mode m-1" data-toggle="tooltip" data-placement="left" title="日间模式">
                        <i class="mode-ico iconfont"></i>
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
<?php if($theme_config['translate_sw'] == 1){ //翻译插件 ?> 
    <script type='text/javascript' src='<?php echo $theme_dir?>/assets/js/translate.js'></script>
<?php } ?> 
<?php if($theme_config['search-modal'] == 1){ require 'search-modal.php';}?>
    <script>var config = <?php echo json_encode($js_config)?></script>
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