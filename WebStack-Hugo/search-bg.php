<?php
if(!empty($theme_config['canvas-bg'])){
    //格式是否正确,正确则按配置选择
    if(preg_match('/^(?:1[0-7]|[1-9])(?:,(?:1[0-7]|[1-9]))*$/', $theme_config['canvas-bg'])){
        $src_s = explode(",", $theme_config['canvas-bg']);
        $src = $src_s[array_rand($src_s)];
    }else{
        $src = rand(1,17);//格式错误时随机选一个
    }
    //清除横幅图,避免浪费资源
    $theme_config['light_bg'] = '';
    $theme_config['night_bg'] = '';
    //HTML代码
    $iframe = '<iframe class="canvas-bg" scrolling="no" sandbox="allow-scripts allow-same-origin" src="'."{$theme_dir}/assets/fx/{$src}.html".'"></iframe>';
}

?>
            <!--search-bg-start-->
            <div class="header-big  post-top css-color mb-4" id="search-bg" light_bg="<?php echo $theme_config['light_bg'];?>" night_bg="<?php echo $theme_config['night_bg'];?>">
                <?php echo @$iframe; ?> 
                <div class="s-search">
                    <div id="search" class="s-search mx-auto" data="<?php echo $theme_config['suggestion'] == 1 ? 1 : 0 ;?>">
                        <?php if(!empty($theme_config['big-title'])){ ?>
                        <div class="big-title text-center mb-3 mb-md-5 mt-2"> <h2 class="h1" style="letter-spacing: 6px;"><?php echo $theme_config['big-title'];?></h2> </div>
                        <?php } ?> 
                        <div id="search-list-menu" class="hide-type-list">
                            <div class="s-type text-center">
                                <div class="s-type-list big">
                                    <div class="anchor" style="position: absolute; left: 50%; opacity: 0;"></div>
                                    <?php 
                                        $search_array = json_decode($theme_config['search-d'], true);
                                        $i = 0;
                                        foreach ($search_array as $search){
                                            $active = $i == 0 ? 'class="active"':'';
                                            echo "<label for=\"{$search['default']}\"  data-id=\"{$search['data-id']}\" {$active}><span>{$search['name']}</span></label>";
                                            $i++;
                                        }
                                    ?>
                                </div>
                            </div>
                        </div>
            
                        <form action="https://www.baidu.com?s=" method="get" target="_blank" class="super-search-fm">
                            <input type="text" id="search-text" class="form-control smart-tips search-key" 
                                zhannei="" placeholder="输入关键字搜索" style="outline:0" autocomplete="off">
                            <button class="submit" type="submit"><i class="iconfont icon-search"></i></button>
                        </form>
                        
                        <div id="search-list" class="hide-type-list">
                            <?php 
                                $i = 0;
                                foreach ($search_array as $search){
                                    echo "<div class=\"search-group {$search['data-id']}\"><ul class=\"search-type\">";
                                    foreach ($search['data'] as $zd){
                                        if($theme_config['search_bookmark'] == 0 && $zd['id'] === 'type-zhannei'){continue;}
                                        $checked = $search['default'] == $zd['id'] && $i == 0 ? 'checked="checked"':'';
                                        echo "<li>
                                            <input hidden=\"\" type=\"radio\" name=\"type\" {$checked} id=\"{$zd['id']}\" value=\"{$zd['value']}\" data-placeholder=\"{$zd['placeholder']}\">
                                            <label for=\"{$zd['id']}\"><span class=\"text-muted\">{$zd['name']}</span></label>
                                        </li>";
                                    }
                                    echo "</ul></div>";
                                    $i++;
                                }
                            ?>
                        </div>
                        <div class="card search-smart-tips search-hot-text">
                            <ul id="word" style="display: none"></ul>
                        </div>
                    </div>
                </div>
                <?php if(!empty($theme_config['carousel'])){ ?>
                <div class="bulletin-big mx-3 mx-md-0">
                	<div id="bulletin_box" class="card my-2">
                		<div class="card-body py-1 px-2 px-md-3 d-flex flex-fill text-xs text-muted">
                			<div>
                				<i class="iconfont icon-bulletin" style="line-height:25px"></i>
                			</div>
                			<div class="bulletin-swiper mx-1 mx-md-2 carousel-vertical">
                				<div class="carousel slide" data-ride="carousel" data-interval="3000">
                					<div class="carousel-inner" role="listbox">
                						<?php echo $theme_config['carousel'];?>
                					</div>
                				</div>
                			</div>
                			<div class="flex-fill"></div>
                			<a title="关闭" href="javascript:;" rel="external nofollow" class="bulletin-close" onclick="$('#bulletin_box').slideUp('slow');">
                				<i class="iconfont icon-close" style="line-height:25px"></i>
                			</a>
                		</div>
                	</div>
                </div>
                <?php } ?>
            </div>
            <!--search-bg-end-->