//夜间模式
(function(){
    
    let Mode = $("#NightMode").attr("data"); 
    let Real_Mode = (new Date().getHours() > 19 || new Date().getHours() < 6)?'1':'0';
    let Loca_Mode = localStorage.getItem("Hugo_Night");
    if(Mode == 3 || Mode == 4){
        SetNightMode(Mode - 3);
    }else if(Loca_Mode == null || Loca_Mode == '' || Loca_Mode == undefined){
        SetNightMode(Mode == 2 ? Real_Mode : Mode);
    }else{
        SetNightMode(Loca_Mode);
    }
    //手动切换
    $('#NightMode').click(function () {
        switchNightMode();
    });
})();
//夜间模式切换
function switchNightMode(){
    let night = $("body").attr('class') == 'io-grey-mode' ? '1' : '0';
    localStorage.setItem("Hugo_Night",night);
    SetNightMode(night);
}

function SetNightMode(night){
    if(night == '0'){
        $("body").attr('class', 'io-grey-mode');
        $("#search-bg").css("background-image", "url(" + $("#search-bg").attr('light_bg') + ")").css("background-color","");   
        $(".switch-dark-mode").attr({"title":"日间模式","data-original-title":"日间模式"});
        $(".mode-ico").removeClass("icon-night").addClass("icon-light");
        if(config.bg_img.length > 0){
            $('body').css('background-image', `url(${config.bg_img})`).css('background-size', 'cover').css('background-attachment', 'fixed');
        }
    }else{
        $("body").attr('class', 'io-black-mode');
        $("#search-bg").css("background-image", "url(" + $("#search-bg").attr('night_bg') + ")").css("background-color", "#1b1d1f"); 
        $(".switch-dark-mode").attr({"title":"夜间模式","data-original-title":"夜间模式"});
        $(".mode-ico").removeClass("icon-light").addClass("icon-night");
        if(config.bg_img_night.length > 0){
            $('body').css('background-image', `url(${config.bg_img_night})`).css('background-size', 'cover').css('background-attachment', 'fixed');
        }else{
            $('body').css('background-image', 'none');
        }
    }
}
(function($){ 
    $(document).ready(function(){
        //显示主体
        $('#loading').addClass('close');
        setTimeout(function() {
            $('#loading').remove();
        }, 500);
        
        if(localStorage.getItem("searchlist") == null){
            var activeLabel = $('.s-type-list.big label.active');
            localStorage.setItem("searchlist", activeLabel.attr('for'));
            localStorage.setItem("searchlistmenu", activeLabel.attr('data-id'));
        }
        //搜索模块
        if($("#search").length > 0) { intoSearch(); } 
        //粘性页脚
        stickFooter();
        //初始化tab滑块
        intoSlider();
        //分类定位
        setTimeout(function () {
            let hash = window.location.hash;
            if (hash.length > 0) { 
                if (hash.startsWith('#category-')) {
                    $('a.smooth[href="' + window.location.hash + '"]').click();
                }else{
                    $('body,html').animate({scrollTop: 0}, 500);
                }
            };
        }, 300);
        //分类栏点击事件
        $(document).on('click','a.smooth',function(ev) {
            //手机端点击后收起侧边栏
            if($('#sidebar').hasClass('show') && !$(this).hasClass('change-href')){
                $('#sidebar').modal('toggle');
            }
            //分类定位
            if($(this).attr("href").substr(0, 1) == "#"){
                $("html, body").animate({
                    scrollTop: $($(this).attr("href")).offset().top - 90
                }, {
                    duration: 500,
                    easing: "swing"
                });
            }
            if(!$(this).hasClass('change-href')){
                var menu =  $("a"+$(this).attr("href"));
                menu.click();
                toTarget(menu.parent().parent(),true,true);
            }
        });
        //是否默认展开侧边栏
        if($("#sidebar").attr("data") == 1){
            $('#mini-button').click();
        }
        //失败图标
        $('#content img.lazy').attr('onerror', "javascript:this.src='./templates/admin/img/ie.svg'");
    });
    
    //粘性页脚
    $(window).resize(function() {
        setTimeout(stickFooter, 200); 
    });
    function stickFooter() {
        $('.main-footer').attr('style', '');
        if($('.main-footer').hasClass('text-xs')){
            var win_height          = jQuery(window).height(),
                footer_height       = $('.main-footer').outerHeight(true),
                main_content_height = $('.main-footer').position().top + footer_height;
            if(win_height > main_content_height - parseInt($('.main-footer').css('marginTop'), 10)){
                $('.main-footer').css({
                    marginTop: win_height - main_content_height  
                });
            }
        }
    }

    var have_search = $("#search-bg").length > 0;
    if(have_search == false){
        $('.big-header-banner').addClass('header-bg');
    }
    //返回顶部
    $(window).scroll(function () {
        if ($(this).scrollTop() >= 50) {
            $('#to-up').fadeIn(200);
            if(have_search){$('.big-header-banner').addClass('header-bg')}
        } else {
            $('#to-up').fadeOut(200);
            if(have_search){ $('.big-header-banner').removeClass('header-bg')}
        }
    });
    $('#to-up').click(function () {
        $('body,html').animate({scrollTop: 0}, 500);
        window.location.hash = '#header';
    }); 

    //搜索图标
    if ($("#search-modal").length == 0 &&  $("#search").length > 0) { 
        $(".search-modal") .click(function () {
            $("#search-text").focus();
        }); 
    }else if ($("#search-modal").length == 0 &&  $("#search").length == 0) { 
        $('.search-modal').remove();
    }
    
    //站内搜索
    var timeoutId;
    var search_keywords;
    $('#search-text').keyup(function(e){
        search_keywords = $(this).val();
        if(config.search_bookmark == 3 || localStorage.getItem("searchlist") == 'type-zhannei'){
            if(search_keywords == '' || e.key == 'Escape'){
                $('.screen').hide();
            }else if(( config.search_bookmark == 1 || config.search_bookmark == 3 ) && e.which != 13){
                //输入节流(防抖)
                clearTimeout(timeoutId);
                timeoutId = setTimeout(function() {
                    if(search_keywords == ''){ return false; } else{ search(search_keywords); }
                }, 200); 
            }else if(config.search_bookmark == 2 && e.which == 13){
                search(search_keywords);
            }
        }
    });
    
    //站内搜索函数
    function search(keywords){
        $('.screen').show();
        $('#screen_flex').html('<div class="col-lg-12 search_bookmark_tips"><div class="nothing mb-4"><i class="iconfont icon-loading icon-spin mr-2"></i>加载中...</div></div>');
        $.ajax({
            url: `./?theme=WebStack-Hugo&u=${u}&method=search&keywords=${keywords}`,
            type: 'POST',
            data: [],
            processData: false,
            contentType: false,
            success: function(data) {
    		  if(data.code == 1) {
    		      let url_card_all = '';
    		      data.data.forEach(function(link) {
    		          url_card_all = url_card_all + 
`
<div class="url-card col-6 col-sm-6 col-md-4 col-xl-5a col-xxl-6a" id="s${link.id}">
    <div class="url-body default">
        <a href="${link.url}" target="_blank" class="card no-c mb-4">
            <div class="card-body">
                <div class="url-content d-flex align-items-center">
                    <div class="url-img mr-2 d-flex align-items-center justify-content-center"><img class="lazy loaded" data-src="${link.icon}" src="./templates/admin/img/ie.svg"></div>
                    <div class="url-info flex-fill">
                        <div class="text-sm overflowClip_1"><strong>${link.title}</strong></div>
                        ${data.description == '1' ? '<p class="overflowClip_1 m-0 text-muted text-xs">'+link.description+'</p>' : ''}
                    </div>
                </div>
            </div>
        </a>
        ${config.zhida ? '<a href='+link.real_url+' class="togo text-center" data-toggle="tooltip" data-placement="right" title="" rel="nofollow" data-original-title="直达"><i class="iconfont icon-goto"></i></a>':''}
    </div>
</div>`;
    		      });
    		      $('#screen_flex').html(url_card_all);
    		      $('img.lazy').attr('onerror', "javascript:this.src='./templates/admin/img/ie.svg'");
    		      //重载右键菜单
    		      if(config.admin){ card_menu(); }
    		  } else {
    		      $('.search_bookmark_tips .nothing').html(data.msg);
    		  }
            },
            error: function(xhr, textStatus, errorThrown) {
                $('.search_bookmark_tips .nothing').html('请求失败..');
            }
        });
    }
    
    //移动端展开菜单
    $('#sidebar-switch').on('click',function(){
        $('#sidebar').removeClass('mini-sidebar');
    });
    
    //是否收起菜单
    $('.sidebar-menu-inner a').on('click',function(){
        if (!$('.sidebar-nav').hasClass('mini-sidebar')) {//菜单栏没有最小化   
            $(this).parent("li").siblings("li.sidebar-item").children('ul').slideUp(200);
            if ($(this).next().css('display') == "none") { //展开
                $(this).next('ul').slideDown(200);
                $(this).parent('li').addClass('sidebar-show').siblings('li').removeClass('sidebar-show');
            }else{ //收缩
                $(this).next('ul').slideUp(200);
                $(this).parent('li').removeClass('sidebar-show');
            }
        }
    });
    //PC菜单收起展开
    $('#mini-button').on('click',function(){
        trigger_lsm_mini();
    });
    function trigger_lsm_mini(){
        if ($('.header-mini-btn input[type="checkbox"]').prop("checked")) {
            $('.sidebar-nav').removeClass('mini-sidebar');
            $('.sidebar-menu ul ul').css("display", "none");
            $('.sidebar-nav').addClass('animate-nav');
            $('.sidebar-nav').stop().animate({width: 170},200);
        }else{
            $('.sidebar-item.sidebar-show').removeClass('sidebar-show');
            $('.sidebar-menu ul').removeAttr('style');
            $('.sidebar-nav').addClass('mini-sidebar');
            $('.sidebar-nav .change-href').each(function(){$(this).attr('href',$(this).data('change'))});
            $('.sidebar-nav').addClass('animate-nav');
            $('.sidebar-nav').stop().animate({width: 60},200);
        }
    }
    //显示2级悬浮菜单
    $(document).on('mouseover','.mini-sidebar .sidebar-menu ul:first>li,.mini-sidebar .flex-bottom ul:first>li',function(){
        var offset = $(this).parents('.flex-bottom').length!=0 ? -3 : 2;
        $(".sidebar-popup.second").length == 0 && ($("body").append("<div class='second sidebar-popup sidebar-menu-inner text-sm'><div></div></div>"));
        $(".sidebar-popup.second>div").html($(this).html());
        $(".sidebar-popup.second").show();
        var top = $(this).offset().top - $(window).scrollTop() + offset; 
        var d = $(window).height() - $(".sidebar-popup.second>div").height();
        if(d - top <= 0 ){
            top  = d >= 0 ?  d - 8 : 0;
        }
        $(".sidebar-popup.second").stop().animate({"top":top}, 50);
    });
    //隐藏悬浮菜单面板
    $(document).on('mouseleave','.mini-sidebar .sidebar-menu ul:first, .mini-sidebar .slimScrollBar,.second.sidebar-popup',function(){
        $(".sidebar-popup.second").hide();
    });
    //常驻2级悬浮菜单面板
    $(document).on('mouseover','.mini-sidebar .slimScrollBar,.second.sidebar-popup',function(){
        $(".sidebar-popup.second").show();
    });
    
    //滑块菜单
    $('.slider_menu').children("ul").children("li").not(".anchor").hover(function() {
        $(this).addClass("hover"),
        toTarget($(this).parent(),true,true) 
    }, function() {
        $(this).removeClass("hover") 
    });
    $('.slider_menu').mouseleave(function(e) {
        var menu = $(this).children("ul");
        window.setTimeout(function() { 
            toTarget(menu,true,true) 
        }, 50)
    }) ; 
    //tab滑块
    function intoSlider() {
        $(".slider_menu[sliderTab]").each(function() {
            var menu = $(this).children("ul");
            menu.prepend('<li class="anchor" style="position:absolute;width:0;height:28px"></li>');
            var target = menu.find('.active').parent();
            if(0 < target.length){
                menu.children(".anchor").css({
                    left: target.position().left + target.scrollLeft() + "px",
                    width: target.outerWidth() + "px",
                    height: target.height() + "px",
                    opacity: "1"
                })
            }
            $(this).addClass('into');
        })
    }
    //搜索模块
    function intoSearch() {
        if(window.localStorage.getItem("searchlist")){
            $(".hide-type-list input#"+window.localStorage.getItem("searchlist")).prop('checked', true);
            $(".hide-type-list input#m_"+window.localStorage.getItem("searchlist")).prop('checked', true);
        }
        if(window.localStorage.getItem("searchlistmenu")){
            $('.s-type-list.big label').removeClass('active');
            $(".s-type-list [data-id="+window.localStorage.getItem("searchlistmenu")+"]").addClass('active');
        }
        toTarget($(".s-type-list.big"),false,false);
        $('.hide-type-list .s-current').removeClass("s-current");
        $('.hide-type-list input:radio[name="type"]:checked').parents(".search-group").addClass("s-current"); 
        $('.hide-type-list input:radio[name="type2"]:checked').parents(".search-group").addClass("s-current");
        $(".super-search-fm").attr("action",$('.hide-type-list input:radio:checked').val());
        $(".search-key").attr("placeholder",$('.hide-type-list input:radio:checked').data("placeholder")); 
        if(window.localStorage.getItem("searchlist")=='type-zhannei'){
            $(".search-key").attr("zhannei","true"); 
        }
    }
    $(document).on('click', '.s-type-list label', function(event) {
        $('.s-type-list.big label').removeClass('active');
        $(this).addClass('active');
        window.localStorage.setItem("searchlistmenu", $(this).data("id"));
        var parent = $(this).parents(".s-search");
        parent.find('.search-group').removeClass("s-current");
        parent.find('#'+$(this).attr("for")).parents(".search-group").addClass("s-current"); 
        toTarget($(this).parents(".s-type-list"),false,false);
    });
    $('.hide-type-list .search-group input').on('click', function() {
        var parent = $(this).parents(".s-search");
        window.localStorage.setItem("searchlist", $(this).attr("id").replace("m_",""));
        
        parent.children(".super-search-fm").attr("action",$(this).val());
        parent.find(".search-key").attr("placeholder",$(this).data("placeholder"));
        if($(this).attr('id')=="type-zhannei" || $(this).attr('id')=="m_type-zhannei"){
            parent.find(".search-key").attr("zhannei","true");
        }else{
            parent.find(".search-key").attr("zhannei","");
            $('.screen').hide();
        }
        parent.find(".search-key").select();
        parent.find(".search-key").focus();
    });
    $(document).on("submit", ".super-search-fm", function() {
        var key = encodeURIComponent($(this).find(".search-key").val());
        if(localStorage.getItem("searchlist") == 'type-zhannei' && key != ''){
            search($("#search-text").val());
            return false;
        }
        if(key == ""){
            return false;
        }else{
            window.open( $(this).attr("action") + key);
            return false;
        }
    });
    
    //搜索建议
    if($("#search").attr("data") == 1 && $("#search").length > 0){
        let hotList = 0;
        let current_li = 0;
         $('#search-text').keyup(function(event) {
            let keywords = $(this).val();
            let searchlist = localStorage.getItem("searchlist");
            if (event.keyCode >= 37 && event.keyCode <= 40){ return; }
            if (keywords == '' || searchlist == 'type-zhannei' || event.key == 'Escape' ) { $('#word').hide(); return };
            $.ajax({
                url: 'https://suggestion.baidu.com/su?wd=' + keywords,
                dataType: 'jsonp',
                jsonp: 'cb',
                success: function(res) {
                    $('#word').empty().show();
                    hotList = res.s.length;
                    if (hotList) {
                        $("#word").css("display", "block");
                        for (var i = 0; i < hotList-1; i++) {
                            var liHtml = (i === hotList - 2) ? '<li id="lastHot">' : '<li>';
                            var spanColor = ["#f54545", "#ff8547", "#ffac38"];
                            $("#word").append(liHtml + '<span>' + (i + 1) + "</span>" + res.s[i] + "</li>");
                            if (i === 0) {
                                $("#word ul li").eq(i).css({"border-top": "none"});
                            }
                            if (i <= 2) {
                                $("#word ul span").eq(i).css({"color": "#fff","background": spanColor[i]});
                            }
                        }
                    } else {
                        $("#word").css("display", "none");
                    }
                    current_li = 0;
                },
                error: function() {
                    $('#word').empty().show();
                    $('#word').hide();
                    current_li = 0;
                }
            });
        });
        
        //上下按键选择热词
        $('#search-text').keydown(function(e){
            if ($('#word').css('display') == 'block' && (e.keyCode == 38 || e.keyCode == 40)) {
                current_li = e.keyCode == 38 ? (current_li <= 1 ? hotList - 1 : current_li - 1) : (current_li == hotList - 1 ? 1 : current_li + 1);
                let el = $('#word li').eq(current_li - 1);
                $('#word li').css({'background-color': '', 'color': ''}).eq(current_li - 1).css({'background-color':'#f1f1f1', 'color':'#7bb1eb'});
                let text = el.contents().filter(function() { return this.nodeType === 3; }).text();
                $('#search-text').val(text);
                return false;
            } 
        });
        //点击搜索数据复制给搜索框
        $(document).on('click', '#word li', function() {
            var word = $(this).text().replace(/^[0-9]/, '');
            $('#search-text').val(word);
            $('#word').empty();
            $('#word').hide();
            $('.submit').trigger('click');//触发搜索事件
        });
        $(document).on('click', '.io-grey-mode, .io-black-mode', function() {
            $('#word').empty();
            $('#word').hide();
        });

    }
    
    //动态加载二级分类数据
    $(".nav-link") .click(function () {
        let tab_id = $(this).attr('href');
        let load = $(tab_id).attr('load');
        let cid = tab_id.split('-')[1];
        if(load == '0') {
            $(tab_id).attr('load','1')
            $('#' + cid).html('<div class="col-lg-12 search_bookmark_tips"><div class="nothing mb-4"><i class="iconfont icon-loading icon-spin mr-2"></i>加载中...</div></div>');
            $.ajax({
                url: `./?theme=WebStack-Hugo&u=${u}&format=json&cid=${cid}`,
                type: 'POST',
                data: [],
                processData: false,
                contentType: false,
                success: function(data) {
    		        if(data[0].link_count > 0 || data[0].wz_count > 0 ) {
    		            let url_card_all = '';
    		            data[0].link.forEach(function(link) {
    		                url_card_all = url_card_all + 
`<div class="url-card col-6 col-sm-6 col-md-4 col-xl-5a col-xxl-6a ajax-url" id="l${link.id}" >
    <div class="url-body default">
        <a href="${link.url}" target="_blank" data-url="${link.url}" class="card no-c mb-4" data-placement="bottom" data-toggle="tooltip" data-original-title="${link.description}">
            <div class="card-body">
                <div class="url-content d-flex align-items-center">
                    <div class="url-img mr-2 d-flex align-items-center justify-content-center"><img src="${link.ico}"></div>
                    <div class="url-info flex-fill">
                        <div class="text-sm overflowClip_1"><strong>${link.title}</strong></div>
                        ${config.hide_description ? '':'<p class="overflowClip_1 m-0 text-muted text-xs">'+link.description+'</p>'}
                    </div>
                </div>
            </div>
        </a>
        ${config.zhida ? '<a href='+link.real_url+' class="togo text-center" data-toggle="tooltip" data-placement="right" title="" rel="nofollow" data-original-title="直达"><i class="iconfont icon-goto"></i></a>':''}
    </div>
</div>`;
    		            });
    		            $('#' + cid).html(url_card_all);
    		            $('img.lazy').attr('onerror', "javascript:this.src='./templates/admin/img/ie.svg'");
    		            //重载tooltip
    		            if(config.tooltip){
    		                $(`.row-${cid} [data-toggle="tooltip"]`).tooltip();
    		            }
    		            //重载右键菜单
    		            if(config.admin){ card_menu(); }
    		        } else {
    		            $('.search_bookmark_tips .nothing').html('分类下无数据');
    		        }
                },
                error: function(xhr, textStatus, errorThrown) {
                    $('.search_bookmark_tips .nothing').html('请求失败..');
                }
            });
        }
    }); 

    //翻译插件 https://translate.zvo.cn
    if(config.translate_sw == 1){
        translate.selectLanguageTag.show = config.translate_select == 1; //是否显示切换
        translate.setAutoDiscriminateLocalLanguage(); //自动识别语言
        translate.language.setUrlParamControl('lang');
        translate.language.setLocal( config.locale_lang || 'chinese_simplified'); //本地语种
        translate.selectLanguageTag.languages = config.languages || 'chinese_simplified,chinese_traditional,english,korean,japanese'; //翻译语种
        translate.ignore.class.push('hot-rank');//忽略翻译的class元素
        translate.service.use(config.translate_service == 1 ? 'translate.service': 'client.edge'); //翻译通道
        translate.request.listener.start(); //ajax动态翻译
        translate.listener.start(); //动态渲染翻译
        console.log( 'Language: ' + translate.language.getCurrent() );
        translate.listener.execute.renderStartByApi.push(function(uuid){
            console.log('正在翻译中...');
        });
        translate.listener.execute.renderFinishByApi.push(function(uuid){
            console.log('翻译完成.');
        });
        translate.execute(); //执行翻译
        translate.selectLanguageTag.refreshRender();
    }

})(jQuery);

function toTarget(menu, padding, isMult) {
    var slider =  menu.children(".anchor");
    var target = menu.children(".hover").first() ;
    if (target && 0 < target.length){
        
    }else{
        if(isMult){
            target = menu.find('.active').parent();
        }else{
            target = menu.find('.active');
        }
    }
    if(0 < target.length){
        if(padding){
            slider.css({
                left: target.position().left + target.scrollLeft() + "px",
                width: target.outerWidth() + "px",
                opacity: "1"
            });
        }else{
            slider.css({
                left: target.position().left + target.scrollLeft() + (target.outerWidth()/4) + "px",
                width: target.outerWidth()/2 + "px",
                opacity: "1"
            });
        }
    }else{
        slider.css({
            opacity: "0"
        })
    }
}



