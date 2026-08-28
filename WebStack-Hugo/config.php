<?php 
if($_GET['fn'] != 'home'){
    $url = preg_replace('/([?&])fn=[^&]*/', '$1fn=home', $_SERVER['REQUEST_URI']);
    header('Location: ' . $url);
    exit();
}
?>
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title><?php echo $theme;?> - 主题配置</title>
  <meta name="renderer" content="webkit">
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="same-origin">
  <link href="<?php echo $layui['css']; ?>" rel="stylesheet">
  <style>
    ::-webkit-scrollbar {
        width: 6px;
        height: 6px
    }
    ::-webkit-scrollbar-track {
        background-color: transparent;
        -webkit-border-radius: 2em;
        -moz-border-radius: 2em;
        border-radius: 2em;
    }
    ::-webkit-scrollbar-thumb {
        background-color: #9c9da0;
        -webkit-border-radius: 2em;
        -moz-border-radius: 2em;
        border-radius: 2em
    }
    .layui-tab .layui-tab-title li {
        min-width: 40px;
    }
    .tabBody {
        margin: 40px 0 65px 0;
        padding: 20px 0 10px 0;
    }
    .tabBody > div { 
        display: none;
    }
    .layui-form-item {
        margin-bottom: 10px;
    }
  </style>
</head>
<body>
<div class="layui-layout layui-layout-admin">
  <form class="layui-form" lay-filter="form" style="margin-right: 8px;">
    <div class="layui-header" style="background-color: #ffffff;">
      <div class="layui-tab layui-tab-brief layui-btn-container" lay-filter="tabHeader" style="margin: 6px 0;">
        <ul class="layui-tab-title">
          <li class="layui-this">常规配置</li>
          <li>背景和Logo</li>
          <li>搜索引擎</li>
          <li>翻译插件</li>
          <div class="layui-layer-setwin close_btn" style="top: 8px;"><span class="layui-icon layui-icon-close layui-layer-close layui-layer-close1"></span></div>
        </ul>
      </div>
    </div>

    <div class="tabBody">
      <div class="layui-tab layui-show" desc="常规">
        <div class="layui-form-item">
          <label class="layui-form-label">前台管理</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="admin">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">开启且已登录时可以在主页操作书签</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">拖拽排序</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="sort">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">需开启前台管理 (点击下方帮助获取使用说明)</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">悬停提示</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="hover_tip">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">鼠标悬停在链接卡片上的冒泡效果</div>
        </div>
        
        <div class="layui-form-item">
          <label class="layui-form-label">链接直达</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="direct_access">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">链接卡片上的直达功能</div>
        </div>
        
        <div class="layui-form-item">
          <label class="layui-form-label">QQ登录</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="qq_login">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">仅高级版支持,未登录时在主页显示QQ登录</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">站内搜索</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="search_bookmark">
              <option value="0">关闭</option>
              <option value="1">开启(实时)</option>
              <option value="3">开启(实时+全局)</option>
              <option value="2">开启(回车)</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">在搜索框输入关键字查找站内书签</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">聚合搜索</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="search-bg">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">顶部的搜索功能</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">搜索热词</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="suggestion">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">数据来源于百度</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">随处搜索</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="search-modal">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">右上角和右下角那个搜索</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">侧边导航</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="sidebar-nav">
              <option value="0">收起</option>
              <option value="1">展开</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">侧边导航栏的默认状态</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">随机一言</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="hitokoto">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">右上角那一句话</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">延迟加载</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="lazyload">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">延迟加载图标(建议开启)</div>
        </div>
        
        <div class="layui-form-item">
          <label class="layui-form-label">动态加载</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="dynamic_load">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">切换二级分类时动态加载数据,从而节省资源提升主页加载速度</div>
        </div>
        
        <div class="layui-form-item">
          <label class="layui-form-label">分类隐藏</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="hide-category">
              <option value="0">关闭</option>
              <option value="1">自动</option>
              <option value="2">强制</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">分类tab标签是否隐藏一级分类</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">链接描述</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="hide-description">
              <option value="0">显示</option>
              <option value="1">隐藏</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">是否显示链接描述</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">字体大小</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="font-size">
              <option value="13">13</option>
              <option value="14">14(默认)</option>
              <option value="15">15</option>
              <option value="16">16</option>
              <option value="17">17</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">字体大小</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">夜间模式</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="NightMode">
              <option value="0">默认白天</option>
              <option value="1">默认夜间</option>
              <option value="2">自动模式</option>
              <option value="3">强制白天</option>
              <option value="4">强制夜间</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">仅默认状态,前端手动切换时优先</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">加载动画</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="loading">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">是否显示加载中的动画</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">网页快照</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="shot">
              <option value="0">显示链接图标</option>
              <option value="1">mini.s-shot.ru</option>
              <option value="2">s0.wp.com</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">过渡页面的链接预览图调用的API接口</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">页内标题</label>
          <div class="layui-input-block">
            <input type="text" name="big-title" placeholder="搜索框上方的标题" autocomplete="off" class="layui-input" lay-affix="clear">
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">广告/公告</label>
          <div class="layui-input-block">
            <textarea name="carousel" rows="2" placeholder="详情见帮助" class="layui-textarea"></textarea>
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">header代码</label>
          <div class="layui-input-block">
            <textarea name="header_code" rows="2" placeholder="自定义代码" class="layui-textarea"></textarea>
          </div>
        </div>

      </div>


      <div class="layui-tab" desc="背景">

        <div class="layui-form-item">
          <label class="layui-form-label">背景色</label>
          <div class="layui-input-inline" style="width: 120px;">
            <select lay-verify="required" name="bg">
              <option value="not">白色</option>
              <option value="white-bg">白格子</option>
              <option value="grid-bg">灰格子</option>
              <option value="polkadot-bg">小圆点</option>
              <option value="mosaic-bg">马赛克</option>
              <option value="brickwall-bg">砖墙</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">背景色</div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">炫彩横幅</label>
          <div class="layui-input-block">
            <input type="text" name="canvas-bg" placeholder="详情见帮助,范围1-17或#表示随机或1,3,5随机写法" autocomplete="off" class="layui-input" lay-affix="clear">
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">白天背景</label>
          <div class="layui-input-block">
            <input type="text" name="bg_img" placeholder="详情见帮助" autocomplete="off" class="layui-input" style="padding-left: 65px;" lay-affix="clear">
            <i class="layui-icon layui-icon-upload-drag layui-btn layui-btn-primary" style="position: absolute; top:0px;" title="上传"></i>
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">夜间背景</label>
          <div class="layui-input-block">
            <input type="text" name="bg_img_night" placeholder="详情见帮助" autocomplete="off" class="layui-input" style="padding-left: 65px;" lay-affix="clear">
            <i class="layui-icon layui-icon-upload-drag layui-btn layui-btn-primary" style="position: absolute; top:0px;" title="上传"></i>
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">白天横幅</label>
          <div class="layui-input-block">
            <input type="text" name="light_bg" placeholder="详情见帮助,留空则透明" autocomplete="off" class="layui-input" style="padding-left: 65px;" lay-affix="clear">
            <i class="layui-icon layui-icon-upload-drag layui-btn layui-btn-primary" style="position: absolute; top:0px;" title="上传"></i>
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">夜间横幅</label>
          <div class="layui-input-block">
            <input type="text" name="night_bg" placeholder="详情见帮助,留空则黑色背景" autocomplete="off" class="layui-input" style="padding-left: 65px;" lay-affix="clear">
            <i class="layui-icon layui-icon-upload-drag layui-btn layui-btn-primary" style="position: absolute; top:0px;" title="上传"></i>
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">Logo白天</label>
          <div class="layui-input-block">
            <input type="text" name="logo_light" placeholder="白天展开侧边栏的Logo" autocomplete="off" class="layui-input" style="padding-left: 65px;" lay-affix="clear">
            <i class="layui-icon layui-icon-upload-drag layui-btn layui-btn-primary" style="position: absolute; top:0px;" title="上传"></i>
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">Logo夜间</label>
          <div class="layui-input-block">
            <input type="text" name="logo_dark" placeholder="夜间展开侧边栏的Logo" autocomplete="off" class="layui-input" style="padding-left: 65px;" lay-affix="clear">
            <i class="layui-icon layui-icon-upload-drag layui-btn layui-btn-primary" style="position: absolute; top:0px;" title="上传"></i>
          </div>
        </div>

        <div class="layui-form-item">
          <label class="layui-form-label">Logo收起</label>
          <div class="layui-input-block">
            <input type="text" name="logo_collapsed" placeholder="白天和夜间收起侧边栏的Logo" autocomplete="off" class="layui-input" style="padding-left: 65px;" lay-affix="clear">
            <i class="layui-icon layui-icon-upload-drag layui-btn layui-btn-primary" style="position: absolute; top:0px;" title="上传"></i>
          </div>
        </div>
      </div>
      
      <div class="layui-tab" desc="搜索引擎">
          <div class="layui-colla-content layui-show">
            <blockquote class="layui-elem-quote layui-text">使用问题请点击底部帮助进入说明文档</blockquote>
          </div>
          <table class="layui-hide" id="search-d" lay-filter="search-d"></table>
          <script type="text/html" id="search-d-bar">
            <div class="layui-btn-group">
              <a class="layui-btn layui-btn-sm layui-btn-primary" lay-event="group_set" title="设置"><i class="layui-icon layui-icon-set"></i></a>
              <a class="layui-btn layui-btn-sm layui-btn-primary" lay-event="group_del" title="删除"><i class="layui-icon layui-icon-delete"></i></a>
            </div>
          </script>
          
          <table class="layui-hide" id="search-z" lay-filter="search-z"></table>
          <script type="text/html" id="search-z-bar">
            <div class="layui-btn-group">
              <a class="layui-btn layui-btn-sm layui-btn-primary" lay-event="del" title="删除"><i class="layui-icon layui-icon-delete"></i></a>
            </div>
          </script>
          <br /><br />
          <div class="layui-form-item layui-form-text" style="display:none;">
              <textarea class="layui-textarea" name="search-d"></textarea>
          </div>

      </div>
      
      <div class="layui-tab" desc="翻译插件">
        <div class="layui-form-item">
          <label class="layui-form-label">功能开关</label>
          <div class="layui-input-inline" style="width: 125px;">
            <select lay-verify="required" name="translate_sw">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">是否开启前端主页的自动翻译插件</div>
        </div>
        
        <div class="layui-form-item">
          <label class="layui-form-label">手动切换</label>
          <div class="layui-input-inline" style="width: 125px;">
            <select lay-verify="required" name="translate_select">
              <option value="0">关闭</option>
              <option value="1">开启</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">可以关闭、会根据客户端语言自动翻译</div>
        </div>
        
        <div class="layui-form-item">
          <label class="layui-form-label">翻译服务</label>
          <div class="layui-input-inline" style="width: 125px;">
            <select lay-verify="required" name="translate_service">
              <option value="0">edge ( 推荐 )</option>
              <option value="1">translate</option>
            </select>
          </div>
          <div class="layui-form-mid layui-word-aux">默认使用微软edge提供的翻译服务、若不可用请尝试切换</div>
        </div>
        
        <div class="layui-form-item">
          <label class="layui-form-label">本地语种</label>
          <div class="layui-input-block">
            <input type="text" name="locale_lang" placeholder="可不填、默认为简体中文、详情见帮助" autocomplete="off" class="layui-input" >
          </div>
        </div>
        
        <div class="layui-form-item">
          <label class="layui-form-label">翻译语种</label>
          <div class="layui-input-block">
            <input type="text" name="languages" placeholder="可不填、默认简体中文/繁体中文/英语/韩语/日语、支持113种语种、详情见帮助" autocomplete="off" class="layui-input" >
          </div>
        </div>
        
      </div>
      
    </div>

    <div class="layui-footer" style="left: 0;padding: 10px;z-index: 1000;background-color: rgb(255 255 255);">
      <a class="layui-btn layui-btn-primary layui-border-black close_btn">关闭</a>
      <a class="layui-btn layui-btn-primary layui-border-black" id="help">帮助</a>
      <button class="layui-btn" lay-submit lay-filter="save" id="save">保存</button>
      <span class="layui-hide-xs" style="margin-left: 20px;" title="CTRL + S 也可以保存, ESC 也可以关闭">Alt + S 可快速保存设置 Alt + C 关闭配置页面</span>
    </div>
  </form>
</div>

<script src="<?php echo $layui['js']; ?>"></script>
<script src="./templates/admin/js/public.js?v=<?php echo $Ver;?>"></script>
<script src="<?php echo $libs?>/Other/ClipBoard.min.js"></script>
<script>
const u = _GET('u');
const fn = _GET('fn');
const t = _GET('theme');
const isSupported = ClipboardJS.isSupported();

layui.use( function(){
    var element = layui.element;
    var form = layui.form;
    var upload = layui.upload;
    var table = layui.table;
    var $ = layui.$;
    
    //表单赋值
    form.val('form', <?php echo json_encode($theme_config);?>);
    
    //获取焦点
    $('#save').focus();
    
    //tab切换事件
    element.on('tab(tabHeader)', function(data){
        $('.tabBody .layui-tab').removeClass('layui-show').eq(data.index).addClass('layui-show');
    });
    
    //保存
    form.on('submit(save)', function(data){
        $.post(get_api('write_theme','config') + `&t=${t}&template_type=${fn}`,data.field,function(data,status){
            if(data.code == 1) {
                layer.msg(data.msg, {icon: 1,time: 500,end: function() {if(_GET('source') != 'admin'){parent.location.reload();}}});
            }else{
                layer.msg(data.msg, {icon: 5});
            }
        });
        return false; 
    });
    
    //上传图片
    upload.render({
        elem: '.layui-icon-upload-drag',
        url: get_api('write_upload_img','user'),
        exts: 'jpg|jpeg|png|bmp|gif|ico|svg|webp', 
        acceptMime:  'image/*',
        size: 10240,
        done: function(res, index, upload){
            if(res.code == '1'){
                $(this.item).closest('.layui-form-item').find('input[type="text"]').val(res.url);
                layer.msg('上传成功');
            }else{
                layer.msg('上传失败,' + res.msg, {icon: 5});
            }
        }
    });
    
    //关闭
    $('.close_btn').on('click', function(){
        parent.layer.close(parent.layer.getFrameIndex(window.name));
        return false; 
    });
    
    //帮助
    $('#help').on('click', function(){
        window.open("https://docs.twonav.cn/#/theme/WebStack-Hugo");
        return false; 
    });
    
    //按键事件
    $(document).keydown(function(event) {
        if ((event.keyCode == 83 && event.ctrlKey) || (event.keyCode == 83 && event.altKey)) { 
            event.preventDefault();
            $('#save').click();
        }
        if (event.which == 27 || (event.keyCode == 67 && event.altKey)) {
            $('.close_btn').click();
        }
    });
    
    //表格渲染
    table.render({
        elem: '#search-d',
        data: JSON.parse($("textarea[name='search-d']").val()),
        toolbar: `<div>
        <a class="layui-btn layui-btn-sm layui-bg-blue" lay-event="add">添加分组</a>
        <a class="layui-btn layui-btn-sm layui-bg-blue" lay-event="export">导出配置</a>
        <a class="layui-btn layui-btn-sm layui-bg-blue" lay-event="import">导入配置</a>
        <a class="layui-btn layui-btn-sm layui-bg-blue" lay-event="reset">恢复默认</a>
        </div>`,
        defaultToolbar: false,
        page: false,
        cols: [[
          {title:'操作', width: 133,toolbar: '#search-d-bar',align:"center"},
          {field:'name', title: '分组名', width: 128,align:"center"},
          {field:'data-id', title: '分组ID', width: 128,align:"center"},
          {field:'default', title: '默认搜索引擎ID', width: 128,align:"center"},
          {field:'data', title: '搜索引擎',templet: function(d){return JSON.stringify(d.data)}}
        ]]
    });
    table.on('toolbar(search-d)', function(obj){
        if(obj.event == 'add'){
            layer.prompt({title: '请输入分组名'}, function(value, index, elem){
                let group_name = value.trim();
                if(group_name.length == 0){
                    layer.tips('请先输入分组名', elem, {tips: 3});
                    elem.focus();return;
                }else{
                    layer.close(index);
                    layer.prompt({title: '请输入分组ID',value: "group-"}, function(value, index, elem){
                        let group_id = value.trim();
                        if(!group_id.startsWith('group-')){
                            layer.tips('必须以group-开头', elem, {tips: 3});
                            elem.focus();return;
                        }
                        if(group_id.length <= 6){
                            layer.tips('分组ID不合规', elem, {tips: 3});
                            elem.focus();return;
                        }else{
                            let data = JSON.parse($("textarea[name='search-d']").val());
                            let type_id = 'type-' + generateRandomCode();
                            data.push({'default': type_id,'data-id': group_id,'name': group_name,'data': [{"id": type_id,"value": "https://www.baidu.com/s?wd=","placeholder": "百度一下,你就知道","name": "百度"}]});
                            let data_text = JSON.stringify(data);
                            table.reload('search-d',{data: data});
                            $("textarea[name='search-d']").val(data_text);
                            layer.msg('添加分组成功,请进入分组添加搜索引擎', {icon: 1});
                            layer.close(index);
                        }
                    });
                }
            });
        }else if(obj.event == 'import'){ 
            layer.prompt({title: '请输入正确的配置内容', formType: 2, maxlength: 9999}, function(value, index, elem){
              if(isJSON(value)){
                  $("textarea[name='search-d']").val(value);
                  table.reload('search-d',{data: JSON.parse(value)});
                  layer.close(index);
              }else{
                  layer.msg('配置内容有误,请输入正确的配置内容', {icon: 2});
                  return elem.focus();
              }
            });
        }else if(obj.event == 'export'){
            if(isSupported){
                ClipboardJS.copy($("textarea[name='search-d']").val());
                layer.msg('配置内容已复制,请自行粘贴保存', {icon: 1});
            }else{
                layer.msg('复制失败,浏览器不支持', {icon: 5});
            }
        }else if(obj.event == 'reset'){
            layer.confirm('将覆盖当前搜索引擎配置,确定继续吗?',{icon: 3, title:'温馨提示'}, function(index){
                let json_data = [{"default":"type-baidu","data-id":"group-a","name":"常用","data":[{"id":"type-zhannei","value":"https://www.baidu.com/s?wd=","placeholder":"输入链接/标题/描述/关键字","name":"站内"},{"id":"type-baidu","value":"https://www.baidu.com/s?wd=","placeholder":"百度一下，你就知道","name":"百度"},{"id":"type-bing","value":"https://cn.bing.com/search?q=","placeholder":"微软 Bing 搜索","name":"必应"},{"id":"type-google","value":"https://www.google.com/search?q=","placeholder":"谷歌搜索","name":"谷歌"}]},{"default":"type-baidu1","data-id":"group-b","name":"搜索","data":[{"id":"type-baidu1","value":"https://www.baidu.com/s?wd=","placeholder":"百度一下，你就知道","name":"百度"},{"id":"type-google1","value":"https://www.google.com/search?q=","placeholder":"谷歌搜索","name":"谷歌"},{"id":"type-360","value":"https://www.so.com/s?q=","placeholder":"360 好搜","name":"360"},{"id":"type-sogo","value":"https://www.sogou.com/web?query=","placeholder":"搜狗搜索","name":"搜狗"},{"id":"type-bing1","value":"https://cn.bing.com/search?q=","placeholder":"微软 Bing 搜索","name":"必应"},{"id":"type-sm","value":"https://yz.m.sm.cn/s?q=","placeholder":"UC 移动端搜索","name":"神马"}]},{"default":"type-br","data-id":"group-c","name":"工具","data":[{"id":"type-br","value":"https://rank.chinaz.com/all/","placeholder":"请输入网址(不带 https://)","name":"权重查询"},{"id":"type-links","value":"https://link.chinaz.com/","placeholder":"请输入网址(不带 https://)","name":"友链检测"},{"id":"type-icp","value":"https://icp.aizhan.com/","placeholder":"请输入网址(不带 https://)","name":"备案查询"},{"id":"type-ping","value":"https://ping.chinaz.com/","placeholder":"请输入网址(不带 https://)","name":"PING 检测"},{"id":"type-404","value":"https://tool.chinaz.com/Links/?DAddress=","placeholder":"请输入网址(不带https://)","name":"死链检测"}]},{"default":"type-zhihu","data-id":"group-d","name":"社区","data":[{"id":"type-zhihu","value":"https://www.zhihu.com/search?type=content&q=","placeholder":"知乎","name":"知乎"},{"id":"type-wechat","value":"https://weixin.sogou.com/weixin?type=2&query=","placeholder":"微信","name":"微信"},{"id":"type-weibo","value":"https://s.weibo.com/weibo/","placeholder":"微博","name":"微博"},{"id":"type-douban","value":"https://www.douban.com/search?q=","placeholder":"豆瓣","name":"豆瓣"}]},{"default":"type-taobao1","data-id":"group-e","name":"生活","data":[{"id":"type-taobao1","value":"https://s.taobao.com/search?q=","placeholder":"淘宝","name":"淘宝"},{"id":"type-jd","value":"https://search.jd.com/Search?keyword=","placeholder":"京东","name":"京东"},{"id":"type-xiachufang","value":"https://www.xiachufang.com/search/?keyword=","placeholder":"下厨房","name":"下厨房"},{"id":"type-xiangha","value":"https://www.xiangha.com/so/?q=caipu&s=","placeholder":"香哈菜谱","name":"香哈菜谱"},{"id":"type-12306","value":"https://www.12306.cn/?","placeholder":"12306","name":"12306"},{"id":"type-qunar","value":"https://www.qunar.com/?","placeholder":"去哪儿","name":"去哪儿"}]},{"default":"type-zhaopin","data-id":"group-f","name":"求职","data":[{"id":"type-zhaopin","value":"https://sou.zhaopin.com/jobs/searchresult.ashx?kw=","placeholder":"智联招聘","name":"智联招聘"},{"id":"type-51job","value":"https://search.51job.com/?","placeholder":"前程无忧","name":"前程无忧"},{"id":"type-lagou","value":"https://www.lagou.com/jobs/list_","placeholder":"拉钩网","name":"拉钩网"},{"id":"type-liepin","value":"https://www.liepin.com/zhaopin/?key=","placeholder":"猎聘网","name":"猎聘网"}]}];
                $("textarea[name='search-d']").val(JSON.stringify(json_data));
                table.reload('search-d',{data: json_data});
                layer.msg('恢复成功,请点击底部保存');
            });
        }
    });
    //行工具
    table.on('tool(search-d)', function(obj){
        var data = obj.data;
        if(obj.event === 'group_set'){
            $('[lay-table-id="search-d"]').hide(); //隐藏分组表
            
            table.render({
                elem: '#search-z',
                data: data.data,
                toolbar: `<div><a class="layui-btn layui-btn-sm layui-bg-blue" lay-event="to_group"><i class="layui-icon layui-icon-return"></i>保存并返回 </a> 
                <a class="layui-btn layui-btn-sm layui-bg-blue" lay-event="add"><i class="layui-icon layui-icon-addition"></i>添加 </a>
                </div>`,
                defaultToolbar: false,
                page: false,
                cols: [[
                  {title:'操作', width: 80,toolbar: '#search-z-bar',align:"center"},
                  {field:'default',type:'radio',title:'默认', width: 66},
                  {field:'name', title: '名称', width: 128},
                  {field:'id', title: 'ID', width: 128},
                  {field:'placeholder', title: '提示内容', width: 188},
                  {field:'value', title: '搜索引擎', cellMinWidth: 188}
                ]],
                done: function(res, curr, count, origin){
                    //选中默认搜索引擎
                    for (var i = 0; i < res.data.length; i++) {
                        if (res.data[i].id === data.default) {
                            table.setRowChecked('search-z', {type:"radio",index: i});break;
                        }
                    }
                    //工具栏事件
                    table.on('toolbar(search-z)', function(obj){
                        if(obj.event == 'to_group'){
                            $('[lay-table-id="search-z"]').hide();
                            $('[lay-table-id="search-d"]').show();
                            search_z_handle();
                        }else if(obj.event == 'add'){
                            layer.prompt({title: '请输入名称,例如 百度'}, function(add_name, index, elem){
                                if(add_name.trim().length == 0){ layer.tips('请输入名称', elem, {tips: 3});return;}else{layer.close(index);}
                                layer.prompt({title: '请输入ID,例如 type-baidu',value:'type-'}, function(add_id, index, elem){
                                    if(add_id.trim().length <= 5 || !add_id.startsWith('type-') ){ layer.tips('请输入以type-开头的id', elem, {tips: 3});return;}else{layer.close(index);}
                                    layer.prompt({title: '请输入提示内容,例如 百度一下,你就知道'}, function(add_content, index, elem){
                                        if(add_content.trim().length == 0){ layer.tips('请输入提示内容', elem, {tips: 3});return;}else{layer.close(index);}
                                        layer.prompt({title: '请输入链接'}, function(add_url, index, elem){
                                            if(!add_url.startsWith('http://') && !add_url.startsWith('https://') ){ layer.tips('请输入http://或https://开头的链接', elem, {tips: 3});return;}else{layer.close(index);}
                                            let search_z_data = table.getData('search-z');
                                            console.log(search_z_data,add_name,add_id,add_content,add_url );
                                            search_z_data.push({"id": add_id,"value":add_url,"placeholder":add_content,"name": add_name});
                                            table.reload('search-z',{data: search_z_data});
                                        });
                                    });
                                });
                            });
                        }
                    });
                    //行操作事件
                    table.on('tool(search-z)', function(zobj){
                        if(zobj.event == 'del'){
                            //只剩一个的情况
                            if(table.getData('search-z').length == 1){
                                layer.msg('不能在删啦,再删就没有啦', {icon: 5});
                                return;
                            }
                            //二次确认
                            layer.confirm('确认删除?',{icon: 3, title:'温馨提示'}, function(index){
                                zobj.del();
                                //没有默认搜索引擎时将第一个设为默认
                                if(table.checkStatus('search-z').data.length === 0){
                                    for (var i = 0; i < table.cache['search-z'].length; i++) {
                                        if(table.cache['search-z'][i].length != 0){
                                            table.setRowChecked('search-z', {type:"radio",index: i});break;
                                        }
                                    }
                                }
                                layer.close(index);
                            });
                        }
                    });
                    function search_z_handle(){
                        let default_id = table.checkStatus('search-z').data[0].id;
                        let json_data = JSON.parse($("textarea[name='search-d']").val());
                        for (var i = 0; i < json_data.length; i++) {
                            if(json_data[i]['data-id'] == data['data-id']){
                                json_data[i].data = table.getData('search-z');
                                json_data[i].default = default_id;
                            }
                        }
                        $("textarea[name='search-d']").val(JSON.stringify(json_data));
                        table.reload('search-d',{data: json_data});
                    }
                }
            });
        }else if(obj.event === 'group_del'){
            layer.confirm('确认删除?',{icon: 3, title:'温馨提示'}, function(index){
                obj.del();
                search_d_handle();
                layer.msg('记得保存哦');
            });
        }
    });
    
    //生成json配置
    function search_d_handle(){
        $("textarea[name='search-d']").val(JSON.stringify(table.getData('search-d')));
    }
    //判断输入格式
    function isJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }
    //生成随机字符
    function generateRandomCode() {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return code;
    }
    
});
</script>
</body>
</html>