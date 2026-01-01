import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# ===================== 自动计算目标月份 =====================
# 根据当前系统时间减一天自动计算目标年份和月份
#- 回调/反抽幅度阈值: 50%
#- 最大回调/反抽天数: 10 days
#- 放量倍数: 1.2x
#- 缩量倍数: 0.6x
#- 突破确认幅度: 2%
#- 验证天数: 2 days
#- 分析周期月数: 1 month
target_date = datetime.now() - timedelta(days=1)
TARGET_YEAR = target_date.year
TARGET_MONTH = target_date.month

# ===================== 核心配置（可根据需求调整） =====================
#「日线 N 型」= 短线交易核心信号：适配 1-2 周的波段操作，核心看「量价配合 + 短期验证」，需严格执行止损；
CONFIG = {
    "回调/反抽幅度阈值": 0.5,    # 回调/反抽不超过第一波的50%（放宽以适应12月份行情）
    "最大回调/反抽天数": 10,    # 回调/反抽阶段最长10个交易日（放宽以适应12月份行情）
    "放量倍数": 1.2,            # 第一波上涨/下跌的放量阈值（降低以适应12月份成交量）
    "缩量倍数": 0.6,            # 回调/反抽阶段缩量阈值（放宽以适应12月份行情）
    "突破确认幅度": 0.02,       # 第二波突破/跌破幅度≥2%（降低以增加识别机会）
    "验证天数": 2,              # 突破/跌破后站稳2个交易日（缩短以适应12月份）
    "目标月份": TARGET_MONTH,   # 自动计算目标月份（当前系统时间减一天）
    "目标年份": TARGET_YEAR,    # 自动计算目标年份（当前系统时间减一天）
    "分析周期月数": 1            # 分析最近N个月的K线数据
}

# ===================== 数据预处理函数 =====================
def load_and_clean_data(file_path):
    """
    读取日线CSV数据并标准化字段名
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
    required_cols = ['date', 'high', 'low', 'volume']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"数据缺少必要字段：{missing_cols}，请检查CSV格式")
    
    # 日期格式转换 & 排序
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    
    # 筛选最近N个月的K线数据
    if len(df) > 0:
        last_date = df['date'].max()
        start_date = last_date - pd.DateOffset(months=CONFIG['分析周期月数'])
        df = df[df['date'] >= start_date].reset_index(drop=True)
    
    # 计算5日均量（用于放量缩量判定）
    df['ma5_volume'] = df['volume'].rolling(window=5).mean()
    
    return df

# ===================== N型识别核心函数 =====================
def identify_n_pattern(df, pattern_type='positive'):
    """
    识别正N型（positive）/反N型（negative）结构
    返回：包含N型信息的DataFrame
    """
    n_patterns = []
    df_len = len(df)
    
    # 滑动窗口遍历（预留验证天数）
    for i in range(CONFIG['验证天数'] + 2, df_len - CONFIG['验证天数']):
        # 定义关键点位（三波结构）
        # 正N型：S1(波谷1) → H1(波峰1) → S2(波谷2) → H2(波峰2)
        # 反N型：H1(波峰1) → S1(波谷1) → H2(波峰2) → S2(波谷2)
        if pattern_type == 'positive':
            S1_idx = i - CONFIG['验证天数'] - 2
            H1_idx = i - CONFIG['验证天数'] - 1
            S2_idx = i - CONFIG['验证天数']
            H2_idx = i
        else:  # negative
            H1_idx = i - CONFIG['验证天数'] - 2
            S1_idx = i - CONFIG['验证天数'] - 1
            H2_idx = i - CONFIG['验证天数']
            S2_idx = i
        
        # 跳过索引越界
        if min(S1_idx, H1_idx, S2_idx, H2_idx) < 0:
            continue
        
        # 提取关键点位数据
        S1 = df.iloc[S1_idx]['low'] if pattern_type == 'positive' else df.iloc[S1_idx]['low']
        H1 = df.iloc[H1_idx]['high'] if pattern_type == 'positive' else df.iloc[H1_idx]['high']
        S2 = df.iloc[S2_idx]['low'] if pattern_type == 'positive' else df.iloc[S2_idx]['low']
        H2 = df.iloc[H2_idx]['high'] if pattern_type == 'positive' else df.iloc[H2_idx]['high']
        
        # 计算时间间隔（回调/反抽阶段天数）
        days_interval = (df.iloc[S2_idx]['date'] - df.iloc[H1_idx]['date']).days
        
        # ===================== 第一步：高低点规则判定 =====================
        if pattern_type == 'positive':
            # 正N型：S2 > S1 且 H2 > H1
            if not (S2 > S1 and H2 > H1):
                continue
            # 第一波涨幅 & 回调幅度
            first_wave = H1 - S1
            if first_wave <= 0:  # 第一波非上涨，跳过
                continue
            retracement = (H1 - S2) / first_wave
        else:
            # 反N型：H2 < H1 且 S2 < S1
            if not (H2 < H1 and S2 < S1):
                continue
            # 第一波跌幅 & 反抽幅度
            first_wave = H1 - S1
            if first_wave <= 0:  # 第一波非下跌，跳过
                continue
            retracement = (H2 - S1) / first_wave
        
        # ===================== 第二步：幅度+时间规则 =====================
        if not (retracement <= CONFIG['回调/反抽幅度阈值'] and days_interval <= CONFIG['最大回调/反抽天数']):
            continue
        
        # ===================== 第三步：量能规则 =====================
        # 第一波成交量（放量）
        vol1 = df.iloc[S1_idx:H1_idx+1]['volume'].sum()
        ma5_vol1 = df.iloc[H1_idx]['ma5_volume']
        if vol1 < ma5_vol1 * CONFIG['放量倍数']:
            continue
        
        # 回调/反抽阶段成交量（缩量）
        vol2 = df.iloc[H1_idx:S2_idx+1]['volume'].sum()
        if vol2 > vol1 * CONFIG['缩量倍数']:
            continue
        
        # 第二波成交量（再次放量）
        vol3 = df.iloc[S2_idx:H2_idx+1]['volume'].sum()
        if vol3 < vol1:
            continue
        
        # ===================== 第四步：突破/跌破幅度判定 =====================
        if pattern_type == 'positive':
            # 正N型：H2突破H1的幅度≥3%
            break_through_rate = (H2 - H1) / H1
            if break_through_rate < CONFIG['突破确认幅度']:
                continue
        else:
            # 反N型：S2跌破S1的幅度≥3%
            break_down_rate = (S1 - S2) / S1
            if break_down_rate < CONFIG['突破确认幅度']:
                continue
        
        # ===================== 第五步：验证（站稳3个交易日） =====================
        verify_end_idx = H2_idx + CONFIG['验证天数'] if pattern_type == 'positive' else S2_idx + CONFIG['验证天数']
        if verify_end_idx >= df_len:
            continue
        
        if pattern_type == 'positive':
            # 正N型：验证期内不跌破H1
            verify_low = df.iloc[H2_idx:verify_end_idx+1]['low'].min()
            if verify_low < H1:
                continue
        else:
            # 反N型：验证期内不突破H1
            verify_high = df.iloc[S2_idx:verify_end_idx+1]['high'].max()
            if verify_high > H1:
                continue
        
        # ===================== 筛选目标月份的N型 =====================
        confirm_date = df.iloc[H2_idx]['date']
        if confirm_date.year != CONFIG['目标年份'] or confirm_date.month != CONFIG['目标月份']:
            continue
        
        # ===================== 记录有效N型 =====================
        pattern_info = {
            'pattern_type': '正N型' if pattern_type == 'positive' else '反N型',
            'H1_date': df.iloc[H1_idx]['date'].strftime('%Y-%m-%d'),
            'H2_date': df.iloc[H2_idx]['date'].strftime('%Y-%m-%d'),
            'confirm_date': df.iloc[H2_idx]['date'].strftime('%Y-%m-%d'),
            'suggested_buy_date': df.iloc[S2_idx]['date'].strftime('%Y-%m-%d'),  # S2 附近
            'suggested_buy_price': round(df.iloc[S2_idx]['close'], 2),  # S2 收盘价
            'breakthrough_date': df.iloc[H2_idx]['date'].strftime('%Y-%m-%d'),  # 突破日
            'breakthrough_price': round(H1 * 1.01, 2),  # H1 上方 1%
            'S1': round(S1, 2),
            'H1': round(H1, 2),
            'S2': round(S2, 2),
            'H2': round(H2, 2),
            'first_wave': round(first_wave, 2),
            'retracement_rate': round(retracement * 100, 2),  # 回调/反抽幅度（%）
            'break_rate': round(break_through_rate * 100, 2) if pattern_type == 'positive' else round(break_down_rate * 100, 2),
            'vol1': vol1,
            'vol2': vol2,
            'vol3': vol3,
            'is_valid': True
        }
        n_patterns.append(pattern_info)
    
    # 转换为DataFrame输出
    return pd.DataFrame(n_patterns)

# ===================== 可视化函数（可选） =====================
def plot_n_pattern(df, n_patterns_df):
    """
    可视化识别到的N型结构（仅展示第一个有效N型）
    """
    if len(n_patterns_df) == 0:
        print("无有效N型结构，跳过可视化")
        return
    
    # 取第一个有效N型
    first_pattern = n_patterns_df.iloc[0]
    pattern_type = first_pattern['pattern_type']
    confirm_date = first_pattern['confirm_date']
    
    # 筛选可视化区间（确认日期前后15天）
    start_date = pd.to_datetime(confirm_date) - pd.Timedelta(days=15)
    end_date = pd.to_datetime(confirm_date) + pd.Timedelta(days=15)
    plot_df = df[(df['date'] >= start_date) & (df['date'] <= end_date)].copy()
    
    # 绘图
    plt.figure(figsize=(12, 6))
    # 绘制K线高低点
    plt.plot(plot_df['date'], plot_df['high'], color='red', label='最高价', linewidth=1)
    plt.plot(plot_df['date'], plot_df['low'], color='green', label='最低价', linewidth=1)
    # 标注关键点位
    plt.scatter(pd.to_datetime(confirm_date), 
                first_pattern['H2'] if pattern_type == '正N型' else first_pattern['S2'],
                color='orange', s=100, label='确认点', zorder=5)
    plt.scatter(plot_df[plot_df['low'] == first_pattern['S1']]['date'], 
                first_pattern['S1'], color='blue', s=80, label='S1', zorder=5)
    plt.scatter(plot_df[plot_df['high'] == first_pattern['H1']]['date'], 
                first_pattern['H1'], color='purple', s=80, label='H1', zorder=5)
    
    plt.title(f"{pattern_type}结构可视化（确认日期：{confirm_date}）", fontsize=14)
    plt.xlabel("日期")
    plt.ylabel("价格")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()

# ===================== HTML生成函数 =====================
def generate_html_report(all_n_patterns, all_positive_n, all_negative_n, config):
    """
    生成美观的HTML报告
    """
    # 统计信息
    total_count = len(all_n_patterns)
    positive_count = len(pd.concat(all_positive_n, ignore_index=True)) if all_positive_n else 0
    negative_count = len(pd.concat(all_negative_n, ignore_index=True)) if all_negative_n else 0
    
    # 按确认日期排序
    all_n_patterns_sorted = all_n_patterns.sort_values('confirm_date')
    
    # 生成表格行
    table_rows = ""
    for idx, row in all_n_patterns_sorted.iterrows():
        row_class = "positive" if row['pattern_type'] == '正N型' else "negative"
        table_rows += f"""
        <tr class="{row_class}">
            <td>{row['股票代码']}</td>
            <td>{row['H1_date']}</td>
            <td>{row['H2_date']}</td>
            <td>{row['confirm_date']}</td>
            <td>{row['suggested_buy_date']}</td>
            <td>{row['pattern_type']}</td>
            <td class="price">{row['suggested_buy_price']:.2f}</td>
            <td class="rate">{row['break_rate']:.2f}%</td>
            <td class="rate">{row['retracement_rate']:.2f}%</td>
            <td>{row['S1']:.2f}</td>
            <td>{row['H1']:.2f}</td>
            <td>{row['S2']:.2f}</td>
            <td>{row['H2']:.2f}</td>
        </tr>
        """
    
    # 生成HTML内容
    html_content = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{config['目标年份']}年{config['目标月份']}月N型结构识别结果</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        
        .header h1 {{
            font-size: 32px;
            margin-bottom: 10px;
            font-weight: 600;
        }}
        
        .header p {{
            font-size: 16px;
            opacity: 0.9;
        }}
        
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }}
        
        .stat-card {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s;
        }}
        
        .stat-card:hover {{
            transform: translateY(-5px);
        }}
        
        .stat-card h3 {{
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
        }}
        
        .stat-card .value {{
            font-size: 28px;
            font-weight: bold;
            color: #667eea;
        }}
        
        .stat-card.positive .value {{
            color: #28a745;
        }}
        
        .stat-card.negative .value {{
            color: #dc3545;
        }}
        
        .table-container {{
            padding: 30px;
            overflow-x: auto;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        
        thead {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        
        th {{
            padding: 15px 10px;
            text-align: left;
            font-weight: 600;
            white-space: nowrap;
        }}
        
        td {{
            padding: 12px 10px;
            border-bottom: 1px solid #e0e0e0;
        }}
        
        tbody tr:hover {{
            background: #f5f5f5;
        }}
        
        tbody tr.positive {{
            border-left: 4px solid #28a745;
        }}
        
        tbody tr.negative {{
            border-left: 4px solid #dc3545;
        }}
        
        .price {{
            font-weight: 600;
            color: #333;
        }}
        
        .rate {{
            font-weight: 600;
        }}
        
        .rate.positive {{
            color: #28a745;
        }}
        
        .rate.negative {{
            color: #dc3545;
        }}
        
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }}
        
        @media (max-width: 768px) {{
            .stats {{
                grid-template-columns: 1fr;
            }}
            
            th, td {{
                padding: 10px 5px;
                font-size: 12px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 {config['目标年份']}年{config['目标月份']}月N型结构识别结果</h1>
            <p>基于最近{config['分析周期月数']}个月的K线数据分析</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>总计识别</h3>
                <div class="value">{total_count}</div>
            </div>
            <div class="stat-card positive">
                <h3>正N型</h3>
                <div class="value">{positive_count}</div>
            </div>
            <div class="stat-card negative">
                <h3>反N型</h3>
                <div class="value">{negative_count}</div>
            </div>
            <div class="stat-card">
                <h3>分析周期</h3>
                <div class="value">{config['分析周期月数']}个月</div>
            </div>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>股票代码</th>
                        <th>H1日期</th>
                        <th>H2日期</th>
                        <th>确认日期</th>
                        <th>建议买入日期</th>
                        <th>类型</th>
                        <th>建议买入价</th>
                        <th>突破幅度</th>
                        <th>回调幅度</th>
                        <th>S1</th>
                        <th>H1</th>
                        <th>S2</th>
                        <th>H2</th>
                    </tr>
                </thead>
                <tbody>
                    {table_rows}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | 数据来源: 通达信</p>
        </div>
    </div>
</body>
</html>
    """
    
    return html_content

# ===================== 主函数（执行流程） =====================
if __name__ == "__main__":
    import os
    import glob
    
    # -------------------- 获取所有数据文件 --------------------
    data_dir = "./data"
    txt_files = glob.glob(os.path.join(data_dir, "*.txt"))
    
    if not txt_files:
        print(f"未在 {data_dir} 目录下找到任何 .txt 文件")
        exit(1)
    
    print(f"找到 {len(txt_files)} 个数据文件")
    print("=" * 60)
    
    # -------------------- 初始化结果汇总 --------------------
    all_positive_n = []
    all_negative_n = []
    processed_count = 0
    success_count = 0
    
    # -------------------- 循环处理每个文件 --------------------
    for file_path in txt_files:
        file_name = os.path.basename(file_path)
        processed_count += 1
        
        try:
            print(f"\n[{processed_count}/{len(txt_files)}] 处理文件：{file_name}")
            print("-" * 60)
            
            # 步骤1：读取并清洗数据
            df = load_and_clean_data(file_path)
            print(f"  数据读取完成，共{len(df)}条日线记录")
            
            # 步骤2：识别正N型
            positive_n = identify_n_pattern(df, pattern_type='positive')
            if len(positive_n) > 0:
                positive_n['股票代码'] = file_name.replace('.txt', '')
                all_positive_n.append(positive_n)
                print(f"  识别到{len(positive_n)}个有效正N型")
            else:
                print(f"  未识别到有效正N型")
            
            # 步骤3：识别反N型
            negative_n = identify_n_pattern(df, pattern_type='negative')
            if len(negative_n) > 0:
                negative_n['股票代码'] = file_name.replace('.txt', '')
                all_negative_n.append(negative_n)
                print(f"  识别到{len(negative_n)}个有效反N型")
            else:
                print(f"  未识别到有效反N型")
            
            success_count += 1
            
        except Exception as e:
            print(f"  处理失败：{str(e)}")
            continue
    
    # -------------------- 汇总并保存结果 --------------------
    print("\n" + "=" * 60)
    print(f"处理完成：成功 {success_count}/{len(txt_files)} 个文件")
    print(f"筛选目标：{CONFIG['目标年份']}年{CONFIG['目标月份']}月")
    print("=" * 60)
    
    if all_positive_n or all_negative_n:
        all_n_patterns = pd.concat(all_positive_n + all_negative_n, ignore_index=True)
        
        # 生成HTML报告
        html_content = generate_html_report(all_n_patterns, all_positive_n, all_negative_n, CONFIG)
        output_file = f"{CONFIG['目标年份']}年{CONFIG['目标月份']}月N型结构识别结果.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"\n识别结果已保存至：{output_file}")
        print(f"总计识别到 {len(all_n_patterns)} 个N型结构")
        print(f"  - 正N型：{len(pd.concat(all_positive_n, ignore_index=True)) if all_positive_n else 0} 个")
        print(f"  - 反N型：{len(pd.concat(all_negative_n, ignore_index=True)) if all_negative_n else 0} 个")
        
        # 按确认日期排序
        all_n_patterns_sorted = all_n_patterns.sort_values('confirm_date')
        print(f"\n按确认日期排序的前5个N型结构：")
        print(all_n_patterns_sorted[['股票代码', 'confirm_date', 'pattern_type', 'suggested_buy_price', 'break_rate']].head().to_string(index=False))
    else:
        print(f"\n未在{CONFIG['目标年份']}年{CONFIG['目标月份']}月识别到任何有效N型结构")