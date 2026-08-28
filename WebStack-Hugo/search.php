<?php 
if($theme_config['search-bg'] == '1' && $theme_config['search_bookmark'] > 0){
    //usleep(200 * 1000);
}else{
    msgA(['code'=>0,'msg'=>'未开启站内搜索']);
}

$keywords =  trim($_GET['keywords']);
if(strlen($keywords) < 3){
    msgA(['code'=>0,'msg'=>'关键字不能太短哦']);
}

$where['uid'] = UID;
$where['status'] = 1;
$where['fid'] = 0;
$where['ORDER'] = ['weight' => 'ASC'];
if(!is_login){
    $where['property'] = 0;
}
$where['fid'] =  select_db('user_categorys','cid',$where);
if(empty($where['fid'])){
   msgA(['code'=>0,'msg'=>'未找到分类']); 
}
$where['fid'] = array_merge($where['fid'],select_db('user_categorys','cid',$where));
unset($where['category_type']);
$where['OR'] = ['url[~]'=>$keywords,'title[~]'=>$keywords,'description[~]'=>$keywords,'keywords[~]'=>$keywords];
$columns = ['lid(id)','title','url(real_url)','description','icon','fid','pid'];
$links =  select_db('user_links',$columns,$where);

//获取加密的分类ID
if(!is_login){
    $lock =  select_db('user_categorys', 'cid', ['uid'=>UID, 'category_type'=>'link', 'status'=> 1, 'pid[!]' => 0]);
    if(!empty($lock)){
        $lock = array_merge($lock,select_db('user_categorys','cid',['uid'=>UID, 'category_type'=>'link', 'status'=> 1, 'fid' => $lock ]));
        $lock = array_unique($lock);
    }else{
        $lock = [];
    }
}

$param_u = $GLOBALS['global_config']['Default_User'] == U ? '' : "&u={$u}";
foreach ($links as &$link) {
    if(is_login){
        if($site['link_model'] != 'direct'){
            $link['url'] = static_link ? "{$GLOBALS['HOST']}/click-{$UUID}-{$link['id']}.html" : "./?c=click&id={$link['id']}{$param_u}";
        }else{
            $link['url'] = $link['real_url'];
        }
        $link['icon'] = geticourl($site['link_icon'],$link);
    }else{
        if($link['pid'] > 0 || in_array($link['fid'],$lock) || $site['link_model'] != 'direct'){
            $link['url'] = static_link ? "{$GLOBALS['HOST']}/click-{$UUID}-{$link['id']}.html" : "./?c=click&id={$link['id']}{$param_u}";
        }else{
            $link['url'] = $link['real_url'];
        }
        if($link['pid'] > 0 || in_array($link['fid'],$lock)){
            $link['icon'] = $GLOBALS['libs'].'/Other/lock.svg';
        }else{
            $link['icon'] = geticourl($site['link_icon'],$link);
        }
    }
    
    if($link['description'] == '' &&  $site['link_desc'] != ''){
        $link['description'] = $site['link_desc'] == '{yiyan}' ? yiyan() : $site['link_desc'];
    }
    unset($link['fid']);unset($link['pid']);
    if($GLOBALS['theme_config']['direct_access'] == '0'){
       unset($link['real_url']); 
    }
}

//查找文章
$where['category'] = $where['fid'];
$where['ORDER'] = ['top' => 'ASC'];
$where['state'] = is_login ? [1,2]: 1;
$where['OR'] = ['title[~]'=>$keywords,'summary[~]'=>$keywords,'content[~]'=>$keywords];
unset($where['fid'],$where['status'],$where['property']);
$wzs =  select_db('user_article_list',['id','title','summary','cover'],$where);
foreach ($wzs as &$wz) {
    $wzt = [
        'id'=>$wz['id'],
        'title'=>$wz['title'],
        'description'=>$wz['summary'],
        'url'=>static_link ? "{$GLOBALS['HOST']}/article-{$UUID}-{$wz['id']}.html" : "./?c=article&id={$wz['id']}{$param_u}"
    ];
    
    if($site['article_icon'] == '1'){
        $wzt['icon'] = $GLOBALS['favicon'];
    }elseif($site['article_icon'] == '2' && !empty($wz['cover'])){
        $wzt['icon'] = $wz['cover'];
    }elseif($site['article_icon'] == '3'){
        $wzt['icon'] = empty($wz['cover']) ? '//n1.lm21.top/wz/A'.rand(100, 200).'.jpg':$wz['cover'];
    }else{ 
        $wzt['icon'] = './system/ico.php?text='.mb_strtoupper(mb_substr($wz['title'], 0, 1));
    }
    if($GLOBALS['theme_config']['direct_access'] == '1'){
       $wzt['real_url'] = $wzt['url'];
    }
    $links[] = $wzt;
}

if(empty($links) && empty($wzs) ){
   msgA(['code'=>0,'msg'=>'未搜索到结果,请更换关键字']); 
}

msgA(['code'=>1,'msg'=>'success','data'=>$links,'description'=>$GLOBALS['theme_config']['hide-description'] == '1' ? '0' : '1']);