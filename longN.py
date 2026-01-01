import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
import glob
import warnings
from datetime import datetime, timedelta
warnings.filterwarnings('ignore')

# ===================== 核心配置（可根据需求调整） =====================
CONFIG = {
    # 横盘判定参数
    "横盘最小天数": 90,          # 底部横盘≥1个月（30天）
    "横盘最大波动幅度": 0.25,    # 横盘期波动≤25%
    "横盘量能阈值": 0.8,         # 横盘期日均量 ≤ 上涨期日均量×80%（放宽量能要求）
    # N型突破参数（复用之前的核心规则）
    "回调幅度阈值": 0.5,        # 回调≤第一波涨幅50%
    "最大回调天数": 15,          # 回调≤15天
    "放量倍数": 1.2,            # 突破放量≥5日均量×1.2
    "缩量倍数": 0.7,            # 回调缩量≤第一波量能×70%
    "突破确认幅度": 0.02,       # 突破前高≥2%
    "验证天数": 2,              # 突破后站稳2天
    # 止盈止损参数
    "止盈倍数": 1.5,            # 止盈位=第一波涨幅×1.5+突破价
    "止损支撑比例": 0.02        # 止损位=横盘上沿×(1-2%)（容错2%）
}

# ===================== 数据预处理函数 =====================
def load_and_clean_data(file_path):
    """
    读取并标准化日线CSV数据（兼容中英文字段）
    支持常见字段名：日期/Date, 开盘/Open, 最高/High, 最低/Low, 收盘/Close, 成交量/Volume
    """
    # 读取数据（尝试多种编码和分隔符）
    encodings = ['utf-8-sig', 'utf-8', 'gbk', 'gb2312']
    separators = ['\t', ',']  # 优先尝试制表符
    df = None
    last_error = None
    skip_rows = 0
    temp_df = None
    
    # 首先尝试读取文件，检测是否需要跳过第一行（股票信息行）
    for encoding in encodings:
        for sep in separators:
            try:
                temp_df = pd.read_csv(file_path, encoding=encoding, comment='#', sep=sep, nrows=2)
                # 检查第一行的第一列是否为日期格式
                first_col_value = str(temp_df.iloc[0, 0])
                import re
                date_pattern = r'^\d{4}[/\-]\d{2}[/\-]\d{2}$'
                if not re.match(date_pattern, first_col_value):
                    # 第一行不是日期，说明是股票信息，需要跳过
                    skip_rows = 1
                break
            except (UnicodeDecodeError, pd.errors.ParserError) as e:
                last_error = e
                continue
        if temp_df is not None:
            break
    
    # 正式读取数据（使用检测到的skip_rows）
    for encoding in encodings:
        for sep in separators:
            try:
                df = pd.read_csv(file_path, encoding=encoding, comment='#', sep=sep, skiprows=skip_rows)
                break
            except (UnicodeDecodeError, pd.errors.ParserError) as e:
                last_error = e
                continue
        if df is not None:
            break
    
    if df is None:
        raise ValueError(f"无法读取文件。尝试了以下编码：{encodings}，分隔符：{separators}。最后错误：{last_error}")
    
    # 清理列名：去除前后空格
    df.columns = df.columns.str.strip()
    
    # 标准化字段名（兼容中英文）
    col_mapping = {
        '日期': 'date', 'Date': 'date',
        '开盘': 'open', 'Open': 'open',
        '最高': 'high', 'High': 'high',
        '最低': 'low', 'Low': 'low',
        '收盘': 'close', 'Close': 'close',
        '成交量': 'volume', 'Volume': 'volume'
    }
    df.rename(columns=col_mapping, inplace=True)
    
    # 必要字段检查
    required_cols = ['date', 'high', 'low', 'close', 'volume']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"数据缺少必要字段：{missing_cols}，请检查CSV格式")
    
    # 日期格式转换 & 排序
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    
    # 过滤最近一年的数据（当前系统时间减一天）
    end_date = datetime.now() - timedelta(days=1)
    start_date = end_date - timedelta(days=365*5)
    df = df[(df['date'] >= start_date) & (df['date'] <= end_date)].copy()
    df = df.reset_index(drop=True)
    
    # 计算5日均量（放量缩量判定）
    df['ma5_volume'] = df['volume'].rolling(window=5).mean()
    
    return df

# ===================== 第一步：识别底部横盘区间 =====================
def identify_bottom_consolidation(df):
    """
    识别底部长期横盘区间
    返回：包含横盘区间信息的DataFrame
    """
    consolidation_zones = []
    df_len = len(df)
    
    # 滑动窗口遍历（窗口≥横盘最小天数）
    for end_idx in range(CONFIG['横盘最小天数'], df_len):
        start_idx = end_idx - CONFIG['横盘最小天数']
        if start_idx < 0:
            continue
        
        # 提取横盘区间数据
        consolidation_df = df.iloc[start_idx:end_idx+1]
        # 计算横盘关键指标
        zone_low = consolidation_df['low'].min()    # 横盘下沿
        zone_high = consolidation_df['high'].max()  # 横盘上沿
        zone_mid = (zone_low + zone_high) / 2      # 横盘中轴
        # 波动幅度 = (上沿-下沿)/下沿
        volatility = (zone_high - zone_low) / zone_low
        # 横盘期日均量
        avg_vol_consolidation = consolidation_df['volume'].mean()
        # 后续10天日均量（对比量能）
        post_zone_end = end_idx + 10 if end_idx + 10 < df_len else df_len
        avg_vol_post = df.iloc[end_idx:post_zone_end]['volume'].mean() if post_zone_end > end_idx else avg_vol_consolidation
        
        # 横盘判定条件
        if (volatility <= CONFIG['横盘最大波动幅度'] and
            avg_vol_consolidation <= avg_vol_post * CONFIG['横盘量能阈值']):
            # 记录横盘区间
            consolidation_info = {
                'zone_start_date': df.iloc[start_idx]['date'].strftime('%Y-%m-%d'),
                'zone_end_date': df.iloc[end_idx]['date'].strftime('%Y-%m-%d'),
                'zone_low': round(zone_low, 2),
                'zone_high': round(zone_high, 2),
                'zone_mid': round(zone_mid, 2),
                'volatility': round(volatility * 100, 2),
                'avg_vol_consolidation': round(avg_vol_consolidation, 0),
                'start_idx': start_idx,
                'end_idx': end_idx
            }
            consolidation_zones.append(consolidation_info)
    
    # 去重（合并重叠区间）
    if consolidation_zones:
        consolidation_df = pd.DataFrame(consolidation_zones)
        consolidation_df = consolidation_df.drop_duplicates(subset=['zone_start_date', 'zone_end_date'])
        return consolidation_df
    else:
        return pd.DataFrame()

# ===================== 第二步：识别横盘后的N型突破 =====================
def identify_consolidation_n_breakout(df, consolidation_df):
    """
    在横盘区间基础上，识别后续的正N型突破
    返回：包含完整形态信息+入场/止损/止盈的DataFrame
    """
    breakout_results = []
    if consolidation_df.empty:
        return pd.DataFrame()
    
    # 遍历每个横盘区间
    for _, zone in consolidation_df.iterrows():
        zone_end_idx = zone['end_idx']
        zone_high = zone['zone_high']
        zone_low = zone['zone_low']
        # 只看横盘结束后的走势（预留验证天数）
        start_check_idx = zone_end_idx + 1
        if start_check_idx + CONFIG['验证天数'] + 3 >= len(df):
            continue
        
        # 滑动窗口找N型结构（S1→H1→S2→H2）
        for i in range(start_check_idx, len(df) - CONFIG['验证天数']):
            # 定义N型关键点位索引
            S1_idx = i - 2
            H1_idx = i - 1
            S2_idx = i
            H2_idx = i + CONFIG['验证天数']
            if H2_idx >= len(df):
                continue
            
            # 提取关键点位价格
            S1 = df.iloc[S1_idx]['low']    # 波谷1（横盘突破后的回调低点）
            H1 = df.iloc[H1_idx]['high']    # 波峰1（横盘突破后的第一高点）
            S2 = df.iloc[S2_idx]['low']    # 波谷2（回调低点）
            H2 = df.iloc[H2_idx]['high']    # 波峰2（突破高点）
            
            # 第一步：判定是否突破横盘上沿
            if H1 <= zone_high:
                continue  # 未突破横盘上沿，跳过
            
            # 第二步：正N型高低点规则
            if not (S2 > S1 and H2 > H1):
                continue
            
            # 第三步：回调幅度&时间规则
            first_wave = H1 - S1  # 第一波涨幅
            if first_wave <= 0:
                continue
            retracement = (H1 - S2) / first_wave  # 回调幅度
            retracement_days = (df.iloc[S2_idx]['date'] - df.iloc[H1_idx]['date']).days  # 回调天数
            if retracement > CONFIG['回调幅度阈值'] or retracement_days > CONFIG['最大回调天数']:
                continue
            
            # 第四步：回调不跌破横盘上沿（核心支撑）
            if S2 < zone_high * (1 - CONFIG['止损支撑比例']):
                continue
            
            # 第五步：量能规则（放量突破→缩量回调→再次放量）
            vol1 = df.iloc[S1_idx:H1_idx+1]['volume'].sum()  # 第一波量能
            vol2 = df.iloc[H1_idx:S2_idx+1]['volume'].sum()  # 回调量能
            vol3 = df.iloc[S2_idx:H2_idx+1]['volume'].sum()  # 突破量能
            ma5_vol_H1 = df.iloc[H1_idx]['ma5_volume']       # 波峰1的5日均量
            if (vol1 < ma5_vol_H1 * CONFIG['放量倍数'] or
                vol2 > vol1 * CONFIG['缩量倍数'] or
                vol3 < vol1):
                continue
            
            # 第六步：突破确认幅度（H2突破H1≥3%）
            break_through_rate = (H2 - H1) / H1
            if break_through_rate < CONFIG['突破确认幅度']:
                continue
            
            # 第七步：验证期站稳（H2后3天不跌破H1）
            verify_end_idx = H2_idx + CONFIG['验证天数']
            if verify_end_idx >= len(df):
                continue
            verify_low = df.iloc[H2_idx:verify_end_idx+1]['low'].min()
            if verify_low < H1:
                continue
            
            # ===================== 计算入场/止损/止盈点位 =====================
            entry_price = round(H2, 2)                          # 入场价（突破确认价）
            stop_loss_price = round(zone_high * (1 - CONFIG['止损支撑比例']), 2)  # 止损价（横盘上沿-1%）
            take_profit_price = round(entry_price + first_wave * CONFIG['止盈倍数'], 2)  # 止盈价
            
            # 记录完整形态信息
            breakout_info = {
                # 横盘区间信息
                'consolidation_start': zone['zone_start_date'],
                'consolidation_end': zone['zone_end_date'],
                'zone_low': zone['zone_low'],
                'zone_high': zone['zone_high'],
                # N型关键点位
                'S1': round(S1, 2),
                'H1': round(H1, 2),
                'S2': round(S2, 2),
                'H2': round(H2, 2),
                'first_wave': round(first_wave, 2),
                'retracement_rate': round(retracement * 100, 2),
                'break_through_rate': round(break_through_rate * 100, 2),
                # 量能信息
                'vol1': round(vol1, 0),
                'vol2': round(vol2, 0),
                'vol3': round(vol3, 0),
                # 交易点位
                'entry_price': entry_price,
                'stop_loss_price': stop_loss_price,
                'take_profit_price': take_profit_price,
                'profit_loss_ratio': round((take_profit_price - entry_price) / (entry_price - stop_loss_price), 2),
                # 确认日期
                'confirm_date': df.iloc[H2_idx]['date'].strftime('%Y-%m-%d')
            }
            breakout_results.append(breakout_info)
    
    # 转换为DataFrame
    if breakout_results:
        return pd.DataFrame(breakout_results)
    else:
        return pd.DataFrame()

# ===================== 可视化函数（标注横盘+N型+交易点位） =====================
def plot_consolidation_n_breakout(df, breakout_df):
    """可视化识别到的「底部横盘+N型突破」形态（展示第一个有效形态）"""
    if breakout_df.empty:
        print("无有效「底部横盘+N型突破」形态，跳过可视化")
        return
    
    # 取第一个有效形态
    first_breakout = breakout_df.iloc[0]
    # 筛选可视化区间（横盘开始前10天 → 确认日期后20天）
    consolidation_start = pd.to_datetime(first_breakout['consolidation_start']) - pd.Timedelta(days=10)
    confirm_date = pd.to_datetime(first_breakout['confirm_date']) + pd.Timedelta(days=20)
    plot_df = df[(df['date'] >= consolidation_start) & (df['date'] <= confirm_date)].copy()
    
    # 绘图
    fig, ax = plt.subplots(figsize=(14, 8))
    
    # 1. 绘制价格走势
    ax.plot(plot_df['date'], plot_df['close'], color='black', linewidth=1, label='收盘价')
    ax.plot(plot_df['date'], plot_df['high'], color='red', alpha=0.3, linewidth=0.8)
    ax.plot(plot_df['date'], plot_df['low'], color='green', alpha=0.3, linewidth=0.8)
    
    # 2. 标注横盘区间（灰色背景）
    zone_high = first_breakout['zone_high']
    zone_low = first_breakout['zone_low']
    consolidation_end = pd.to_datetime(first_breakout['consolidation_end'])
    ax.axhspan(zone_low, zone_high, 
               xmin=0, xmax=plot_df[plot_df['date'] == consolidation_end].index[0]/len(plot_df),
               color='gray', alpha=0.2, label='底部横盘区间')
    
    # 3. 标注N型关键点位
    ax.scatter(pd.to_datetime(first_breakout['confirm_date']), first_breakout['H2'], 
               color='orange', s=150, label='H2（突破确认点）', zorder=5)
    ax.scatter(plot_df[plot_df['low'] == first_breakout['S1']]['date'], first_breakout['S1'], 
               color='blue', s=100, label='S1（波谷1）', zorder=5)
    ax.scatter(plot_df[plot_df['high'] == first_breakout['H1']]['date'], first_breakout['H1'], 
               color='purple', s=100, label='H1（波峰1）', zorder=5)
    ax.scatter(plot_df[plot_df['low'] == first_breakout['S2']]['date'], first_breakout['S2'], 
               color='green', s=100, label='S2（波谷2）', zorder=5)
    
    # 4. 标注交易点位
    ax.axhline(y=first_breakout['entry_price'], color='red', linestyle='--', linewidth=1.5, label='入场价')
    ax.axhline(y=first_breakout['stop_loss_price'], color='darkred', linestyle='--', linewidth=1.5, label='止损价')
    ax.axhline(y=first_breakout['take_profit_price'], color='darkgreen', linestyle='--', linewidth=1.5, label='止盈价')
    
    # 图表美化
    ax.set_title(f"底部横盘+正N型突破形态（确认日期：{first_breakout['confirm_date']}）", fontsize=14)
    ax.set_xlabel("日期", fontsize=12)
    ax.set_ylabel("价格", fontsize=12)
    ax.legend(loc='upper left')
    ax.grid(True, alpha=0.3)
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()

# ===================== 主函数（执行流程） =====================
if __name__ == "__main__":
    # -------------------- 获取data目录下所有txt文件 --------------------
    data_dir = "./data"
    txt_files = glob.glob(os.path.join(data_dir, "*.txt"))
    
    if not txt_files:
        print(f"未在{data_dir}目录下找到任何.txt文件")
        exit(1)
    
    print(f"找到{len(txt_files)}个数据文件")
    print("=" * 60)
    
    # -------------------- 循环处理所有文件 --------------------
    all_breakout_results = []
    success_count = 0
    
    for idx, file_path in enumerate(txt_files, 1):
        stock_code = os.path.basename(file_path).replace('.txt', '')
        print(f"\n[{idx}/{len(txt_files)}] 处理文件：{stock_code}.txt")
        print("-" * 60)
        
        try:
            # 步骤1：读取并清洗数据
            df = load_and_clean_data(file_path)
            print(f"  数据读取完成，共{len(df)}条日线记录")
            
            # 步骤2：识别底部横盘区间
            consolidation_df = identify_bottom_consolidation(df)
            if consolidation_df.empty:
                print(f"  未识别到符合条件的底部横盘区间")
                continue
            
            print(f"  识别到{len(consolidation_df)}个底部横盘区间")
            
            # 步骤3：识别横盘后的N型突破
            breakout_df = identify_consolidation_n_breakout(df, consolidation_df)
            if breakout_df.empty:
                print(f"  未识别到有效「底部横盘+N型突破」形态")
                continue
            
            print(f"  识别到{len(breakout_df)}个有效突破形态")
            
            # 添加股票代码
            breakout_df['股票代码'] = stock_code
            
            # 收集结果
            all_breakout_results.append(breakout_df)
            success_count += 1
            
        except Exception as e:
            print(f"  处理失败：{str(e)}")
            continue
    
    # -------------------- 汇总并保存结果 --------------------
    print("\n" + "=" * 60)
    print(f"处理完成：成功 {success_count}/{len(txt_files)} 个文件")
    print("=" * 60)
    
    if all_breakout_results:
        # 合并所有结果
        all_breakout_df = pd.concat(all_breakout_results, ignore_index=True)
        
        # 按确认日期排序
        all_breakout_df = all_breakout_df.sort_values('confirm_date').reset_index(drop=True)
        
        print(f"\n总计识别到 {len(all_breakout_df)} 个有效「底部横盘+N型突破」形态")
        
        # 过滤最近一个月的数据（当前系统时间减一天）
        end_date = datetime.now() - timedelta(days=1)
        start_date = end_date - timedelta(days=30)
        all_breakout_df['confirm_date'] = pd.to_datetime(all_breakout_df['confirm_date'])
        all_breakout_df = all_breakout_df[(all_breakout_df['confirm_date'] >= start_date) & 
                                          (all_breakout_df['confirm_date'] <= end_date)].copy()
        all_breakout_df = all_breakout_df.reset_index(drop=True)
        
        print(f"筛选最近一个月（{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}）的数据")
        print(f"筛选后剩余 {len(all_breakout_df)} 个有效形态")
        
        # 同一股票代码和confirm_date只保留一条记录（保留consolidation_end最近的）
        all_breakout_df['consolidation_end'] = pd.to_datetime(all_breakout_df['consolidation_end'])
        all_breakout_df = all_breakout_df.sort_values('consolidation_end', ascending=False)
        all_breakout_df = all_breakout_df.drop_duplicates(subset=['股票代码', 'confirm_date'], keep='first')
        all_breakout_df = all_breakout_df.sort_values('confirm_date').reset_index(drop=True)
        
        print(f"去重后剩余 {len(all_breakout_df)} 个有效形态")
        
        # 展示前10个结果
        core_fields = ['股票代码', 'confirm_date', 'zone_high', 'H2', 'entry_price', 
                      'stop_loss_price', 'take_profit_price', 'profit_loss_ratio']
        print("\n前10个突破形态：")
        print(all_breakout_df[core_fields].head(10).to_string(index=False))
        
        # 保存结果到Excel
        output_file = "底部横盘+N型突破识别结果.xlsx"
        all_breakout_df.to_excel(output_file, index=False)
        print(f"\n识别结果已保存至：{output_file}")
        
        # 可视化第一个有效形态
        if not all_breakout_df.empty:
            first_stock_code = all_breakout_df.iloc[0]['股票代码']
            first_file = os.path.join(data_dir, f"{first_stock_code}.txt")
            df_first = load_and_clean_data(first_file)
            
            # 筛选出该股票的突破形态
            first_breakout = all_breakout_df[all_breakout_df['股票代码'] == first_stock_code].iloc[[0]]
            plot_consolidation_n_breakout(df_first, first_breakout)
    else:
        print("\n未在任何股票中识别到有效「底部横盘+N型突破」形态")