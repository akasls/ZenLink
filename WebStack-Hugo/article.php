<?php
$param_u = $GLOBALS['global_config']['Default_User'] == U ? '' : "&u={$u}";
$categorys = get_db('user_categorys','*',['uid'=>UID,'cid'=>$data['category']]);
$category_url = static_link ? "{$GLOBALS['HOST']}/category-{$UUID}-{$categorys['cid']}.html" : "./?cid={$categorys['cid']}{$param_u}";
$categorys_name = $categorys['name'];
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge, chrome=1" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#f9f9f9" />
    <title><?php echo $data['title'] . ' - ' . $site['subtitle'];?></title>
    <meta name="keywords" content="<?php echo $site['keywords']; ?>" />
    <meta name="description" content="<?php echo $data['summary']; ?>">
    <link rel="shortcut icon" href="<?php echo $favicon;?>">
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/iconfont.css" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $libs?>/bootstrap4/css/bootstrap.min.css" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/style-3.03029.1.css?v=<?php echo $theme_ver; ?>" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/custom-style.css?v=<?php echo $theme_ver; ?>" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $theme_dir?>/assets/css/xcode.min.css" type="text/css" media="all" />
    <link rel="stylesheet" href="<?php echo $libs?>/Font-awesome/4.7.0/css/font-awesome.css">
    <script type="text/javascript" src="<?php echo $theme_dir?>/assets/js/highlight.min.js"></script>
    <script type="text/javascript" src="<?php echo $libs?>/jquery/jquery-3.6.0.min.js"></script>
    <style>
        .copy-btn {
            position: absolute;
            top: 15px;
            right: 15px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            transition: background-color 0.3s, transform 0.2s;
        }
        img {max-width: 100%;margin-bottom: 10px;}
        .content p,li{line-height: 1.7;}
    <?php
        //字体大小
        echo "body,html{font-size:{$theme_config['font-size']}px!important;}";
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

        
        <!--主体内容-->
        <div class="main-content flex-fill" style="margin-left: 0px;">
            <div class="big-header-banner">
                <div id="header" class="page-header sticky" style="left: 0px;height: 60px;">
                    <div class="navbar navbar-expand-md">
                        <div class="container-fluid p-0">
                            <a href="<?php echo $urls['home'];?>" class="navbar-brand d-md-none">
                                <img src="<?php echo $theme_config['logo_light']?>" class="logo-light">
                                <img src="<?php echo $theme_config['logo_dark']?>" class="logo-dark d-none">
                            </a>
                            <div class="collapse navbar-collapse order-2 order-md-1" style="height: 60px;">
                                <ul class="navbar-nav site-menu" style="margin-right: 16px;">
                                    <li ><a href="<?php echo $urls['home'];?>"><i class="fa fa fa-home icon-fw mr-2"></i><span> 首页</span></a></li>
                                <?php 
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
                            <ul class="nav navbar-menu text-xs order-1 order-md-2" style="margin-right: 10px;">
<?php if($theme_config['hitokoto'] == 1){?> 
                                <li class="nav-item mr-3 mr-lg-0 d-none d-lg-block">
                                    <div><a href="javascript:void(0);" style="font-size: <?php echo $theme_config['font-size'];?>px;"><?php echo yiyan();?></a></div>
                                </li>
<?php } ?>
                                <div id="translate"></div>
                            </ul><!--right end--> 
                        </div>
                    </div>
                </div>
            </div>
            
            <main role="main" class="flex-shrink-0">
                <div class="container">
                    <h2 class="mt-5" style="margin-top: 6rem !important;"><?php echo $data['title'];?></h2>
                    <div class="d-flex flex-fill text-muted text-sm border-bottom border-color">
                        <span class="mr-3"><a href="<?php echo $category_url;?>"><i class="fa fa-list-alt "></i> <?php echo $categorys_name;?> </a></span>
                        <span class="mr-3"><i class="fa fa-clock-o"> </i> <?php echo date('Y-m-d', $data['add_time']);?> </span>
                        <span class="mr-3"><i class="fa fa-eye"> </i> <?php echo $data['browse_count'];?> </span>
                    </div>
                    <hr>
                    <div id="wz_content" class="content"><?php echo  str_replace('<img src="', '<img class="lazy spotlight" data-src="', $data['content']);?></div>
                </div>
            </main>
            
            <footer class="main-footer footer-type-1 text-xs">
                <div id="footer-tools" class="d-flex flex-column">
                    <a href="javascript:" id="to-up" class="btn rounded-circle go-up m-1" data-toggle="tooltip" data-placement="left" title="返回顶部">
                        <i class="iconfont icon-to-up"></i>
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
    <script>var u = "<?php echo U;?>";var config = <?php echo json_encode($js_config)?>;hljs.highlightAll();</script>
    <script src="<?php echo $theme_dir?>/assets/js/spotlight.bundle.js"></script>
    <script type='text/javascript' src='<?php echo $libs?>/Other/ClipBoard.min.js'></script>
    <script>
        $('#wz_content pre').each(function() {
            var $pre = $(this);
            var $button = $('<button class="copy-btn">复制代码</button>');
            $pre.append($button);
            var clipboard = new ClipboardJS($button[0], {
                target: function() {
                    return $pre.find('code')[0];
                }
            });
            clipboard.on('success', function(e) {
                alert('复制成功');
            });
            clipboard.on('error', function(e) {
                alert('复制失败，请手动复制');
            });
        });
        $("#wz_content img").addClass("spotlight");
        
        init_lazyImages();
        function init_lazyImages() {
            let lazyImages = $('#wz_content img[data-src]');
            if ('IntersectionObserver' in window) {
                let lazyImageObserver = new IntersectionObserver(function(entries, observer) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            let lazyImage = $(entry.target);
                            lazyImage.attr('src', lazyImage.data('src'));
                            lazyImage.removeClass('lazy');
                            lazyImageObserver.unobserve(entry.target);
                        }
                    });
                });
        
                lazyImages.each(function() {
                    lazyImageObserver.observe(this);
                });
            } else {
                lazyImages.each(function() {
                    $(this).attr('src', $(this).data('src'));
                    $(this).removeClass('lazy');
                });
            }
        }
    </script>
<?php if($theme_config['translate_sw'] == 1){ //翻译插件 ?> 
    <script type='text/javascript' src='<?php echo $theme_dir?>/assets/js/translate.js'></script>
<?php } ?> 
    <script type='text/javascript' src='<?php echo $libs?>/bootstrap4/js/bootstrap.min.js'></script>
    <script type='text/javascript' src='<?php echo $theme_dir?>/assets/js/app-mini.js?v=<?php echo $theme_ver; ?>'></script>
</body>
</html>