import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
import glob
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'SimSun']
plt.rcParams['axes.unicode_minus'] = False

def load_and_clean_data(file_path):
    """读取并标准化日线CSV数据"""
    encodings = ['utf-8-sig', 'utf-8', 'gbk', 'gb2312']
    separators = ['\t', ',']
    df = None
    last_error = None
    skip_rows = 0
    temp_df = None
    
    for encoding in encodings:
        for sep in separators:
            try:
                temp_df = pd.read_csv(file_path, encoding=encoding, comment='#', sep=sep, nrows=2)
                first_col_value = str(temp_df.iloc[0, 0])
                import re
                date_pattern = r'^\d{4}[/\-]\d{2}[/\-]\d{2}$'
                if not re.match(date_pattern, first_col_value):
                    skip_rows = 1
                break
            except (UnicodeDecodeError, pd.errors.ParserError) as e:
                last_error = e
                continue
        if temp_df is not None:
            break
    
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
        return None
    
    df.columns = df.columns.str.strip()
    col_mapping = {
        '日期': 'date', 'Date': 'date',
        '开盘': 'open', 'Open': 'open',
        '最高': 'high', 'High': 'high',
        '最低': 'low', 'Low': 'low',
        '收盘': 'close', 'Close': 'close',
        '成交量': 'volume', 'Volume': 'volume'
    }
    df.rename(columns=col_mapping, inplace=True)
    
    required_cols = ['date', 'close', 'high', 'low', 'volume']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        return None
    
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').reset_index(drop=True)
    
    return df

def detect_rising_channel(df):
    """检测上升通道形态"""
    if len(df) < 30:
        return None, None
    
    try:
        x = np.arange(len(df))
        y = df['close'].values
        
        z = np.polyfit(x, y, 1)
        slope = z[0]
        intercept = z[1]
        
        if slope > 0:
            residuals = y - (slope * x + intercept)
            std_residuals = np.std(residuals)
            
            if std_residuals / np.mean(y) < 0.1:
                return True, slope
        
        return False, None
    except Exception as e:
        return False, None

def calculate_december_gain(df):
    """计算2025年12月的涨幅"""
    dec_data = df[df['date'].dt.year == 2025]
    if len(dec_data) < 2:
        return None
    
    dec_start = dec_data['date'].min()
    dec_end = dec_data['date'].max()
    
    dec_start_price = dec_data[dec_data['date'] == dec_start]['close'].values[0]
    dec_end_price = dec_data[dec_data['date'] == dec_end]['close'].values[0]
    
    gain = (dec_end_price - dec_start_price) / dec_start_price * 100
    return gain

def calculate_chip_distribution(df, window=60):
    """计算筹码分布"""
    if len(df) < 10:
        return None
    
    window = min(window, len(df))
    recent = df.tail(window).copy()
    
    price_min = recent['low'].min()
    price_max = recent['high'].max()
    price_range = price_max - price_min
    
    if price_range == 0:
        return None
    
    num_bins = 20
    bin_size = price_range / num_bins
    bins = [price_min + i * bin_size for i in range(num_bins + 1)]
    
    chip_distribution = []
    for i in range(num_bins):
        bin_low = bins[i]
        bin_high = bins[i + 1]
        
        mask = (recent['low'] <= bin_high) & (recent['high'] >= bin_low)
        bin_volume = recent[mask]['volume'].sum()
        
        if bin_volume > 0:
            weighted_price = ((recent[mask]['close'] * recent[mask]['volume']).sum() / bin_volume)
        else:
            weighted_price = (bin_low + bin_high) / 2
        
        chip_distribution.append({
            'price_low': bin_low,
            'price_high': bin_high,
            'price_mid': (bin_low + bin_high) / 2,
            'volume': bin_volume,
            'weighted_price': weighted_price
        })
    
    total_volume = sum(item['volume'] for item in chip_distribution)
    sorted_chips = sorted(chip_distribution, key=lambda x: x['volume'], reverse=True)
    top3_volume = sum(item['volume'] for item in sorted_chips[:3])
    concentration = (top3_volume / total_volume * 100) if total_volume > 0 else 0
    
    peaks = []
    valleys = []
    for i in range(1, len(chip_distribution) - 1):
        if (chip_distribution[i]['volume'] > chip_distribution[i-1]['volume'] and 
            chip_distribution[i]['volume'] > chip_distribution[i+1]['volume']):
            peaks.append(chip_distribution[i])
        elif (chip_distribution[i]['volume'] < chip_distribution[i-1]['volume'] and 
              chip_distribution[i]['volume'] < chip_distribution[i+1]['volume']):
            valleys.append(chip_distribution[i])
    
    return {
        'distribution': chip_distribution,
        'concentration': round(concentration, 2),
        'peaks': peaks,
        'valleys': valleys,
        'total_volume': total_volume
    }

def calculate_chip_profit_ratio(df, current_price=None):
    """计算筹码获利比例"""
    if len(df) < 30:
        return None
    
    if current_price is None:
        current_price = df.iloc[-1]['close']
    
    recent = df.tail(60).copy()
    recent['avg_cost'] = (recent['high'] + recent['low'] + recent['close']) / 3
    
    profit_volume = recent[recent['avg_cost'] < current_price]['volume'].sum()
    total_volume = recent['volume'].sum()
    
    profit_ratio = (profit_volume / total_volume * 100) if total_volume > 0 else 0
    
    avg_cost = (recent['avg_cost'] * recent['volume']).sum() / total_volume if total_volume > 0 else current_price
    
    cost_deviation = ((current_price - avg_cost) / avg_cost * 100) if avg_cost > 0 else 0
    
    return {
        'profit_ratio': round(profit_ratio, 2),
        'avg_cost': round(avg_cost, 2),
        'cost_deviation': round(cost_deviation, 2),
        'current_price': round(current_price, 2)
    }

def analyze_chip_statistics(df, stock_code):
    """分析筹码统计"""
    if len(df) < 30:
        return None
    
    chip_dist = calculate_chip_distribution(df, window=min(60, len(df)))
    if chip_dist is None:
        return None
    
    chip_profit = calculate_chip_profit_ratio(df)
    
    peaks = chip_dist['peaks']
    valleys = chip_dist['valleys']
    
    max_peak = max(peaks, key=lambda x: x['volume']) if peaks else None
    max_valley = max(valleys, key=lambda x: x['volume']) if valleys else None
    
    concentration = chip_dist['concentration']
    if concentration > 70:
        chip_status = '高度集中'
    elif concentration > 50:
        chip_status = '中度集中'
    elif concentration > 30:
        chip_status = '分散'
    else:
        chip_status = '极度分散'
    
    current_price = df.iloc[-1]['close']
    if max_peak:
        price_to_peak = (current_price - max_peak['price_mid']) / max_peak['price_mid'] * 100
        if price_to_peak > 10:
            chip_position = '峰上'
        elif price_to_peak < -10:
            chip_position = '峰下'
        else:
            chip_position = '峰中'
    else:
        chip_position = '无法判断'
    
    return {
        'stock_code': stock_code,
        'chip_concentration': concentration,
        'chip_status': chip_status,
        'chip_position': chip_position,
        'profit_ratio': chip_profit['profit_ratio'],
        'avg_cost': chip_profit['avg_cost'],
        'cost_deviation': chip_profit['cost_deviation'],
        'peak_price': round(max_peak['price_mid'], 2) if max_peak else 0,
        'peak_volume': round(max_peak['volume'], 2) if max_peak else 0,
        'valley_price': round(max_valley['price_mid'], 2) if max_valley else 0,
        'valley_volume': round(max_valley['volume'], 2) if max_valley else 0,
        'num_peaks': len(peaks),
        'num_valleys': len(valleys)
    }

def analyze_stock(df, stock_code):
    """分析单只股票"""
    dec_2025 = df[df['date'].dt.year == 2025]
    if len(dec_2025) == 0:
        return None
    
    dec_start = dec_2025[dec_2025['date'].dt.month == 12]['date'].min()
    if pd.isna(dec_start):
        return None
    
    pre_start = dec_start - pd.Timedelta(days=180)
    df_pre = df[(df['date'] >= pre_start) & (df['date'] < dec_start)].copy()
    
    if len(df_pre) < 30:
        return None
    
    df_pre['ma5'] = df_pre['close'].rolling(window=5).mean()
    df_pre['ma10'] = df_pre['close'].rolling(window=10).mean()
    df_pre['ma20'] = df_pre['close'].rolling(window=20).mean()
    df_pre['volume_ma5'] = df_pre['volume'].rolling(window=5).mean()
    
    is_rising, slope = detect_rising_channel(df_pre)
    
    if not is_rising:
        return None
    
    volatility = (df_pre['high'].max() - df_pre['low'].min()) / df_pre['low'].min()
    current_price = df_pre.iloc[-1]['close']
    price_range = df_pre['high'].max() - df_pre['low'].min()
    price_position = (current_price - df_pre['low'].min()) / price_range * 100 if price_range > 0 else 50
    
    recent_vol = df_pre.tail(10)['volume'].mean()
    early_vol = df_pre.head(30)['volume'].mean()
    volume_change = recent_vol / early_vol if early_vol > 0 else 1
    
    dec_gain = calculate_december_gain(df)
    if dec_gain is None:
        return None
    
    ma5 = df_pre['ma5'].iloc[-1]
    ma10 = df_pre['ma10'].iloc[-1]
    ma20 = df_pre['ma20'].iloc[-1]
    
    if not pd.isna(ma5) and not pd.isna(ma10) and not pd.isna(ma20):
        if ma5 > ma10 > ma20:
            ma_trend = '多头排列'
        elif ma5 < ma10 < ma20:
            ma_trend = '空头排列'
        else:
            ma_trend = '缠绕'
    else:
        ma_trend = '数据不足'
    
    chip_stats = analyze_chip_statistics(df_pre, stock_code)
    
    details = {
        'stock_code': stock_code,
        'pre_period_days': len(df_pre),
        'pre_start_date': df_pre.iloc[0]['date'].strftime('%Y-%m-%d'),
        'pre_end_date': df_pre.iloc[-1]['date'].strftime('%Y-%m-%d'),
        'pre_start_price': round(df_pre.iloc[0]['close'], 2),
        'pre_end_price': round(df_pre.iloc[-1]['close'], 2),
        'pre_gain': round((df_pre.iloc[-1]['close'] - df_pre.iloc[0]['close']) / df_pre.iloc[0]['close'] * 100, 2),
        'pre_high': round(df_pre['high'].max(), 2),
        'pre_low': round(df_pre['low'].min(), 2),
        'pre_volatility': round(volatility * 100, 2),
        'price_position': round(price_position, 2),
        'volume_change': round(volume_change, 2),
        'december_gain': round(dec_gain, 2),
        'slope': round(slope, 4),
        'ma_trend': ma_trend,
        'is_rising_channel': True
    }
    
    if chip_stats:
        details['chip_concentration'] = chip_stats['chip_concentration']
        details['chip_status'] = chip_stats['chip_status']
        details['chip_position'] = chip_stats['chip_position']
        details['profit_ratio'] = chip_stats['profit_ratio']
        details['avg_cost'] = chip_stats['avg_cost']
        details['cost_deviation'] = chip_stats['cost_deviation']
        details['peak_price'] = chip_stats['peak_price']
        details['peak_volume'] = chip_stats['peak_volume']
        details['valley_price'] = chip_stats['valley_price']
        details['valley_volume'] = chip_stats['valley_volume']
        details['num_peaks'] = chip_stats['num_peaks']
        details['num_valleys'] = chip_stats['num_valleys']
    else:
        details['chip_concentration'] = 0
        details['chip_status'] = '无法计算'
        details['chip_position'] = '无法判断'
        details['profit_ratio'] = 0
        details['avg_cost'] = 0
        details['cost_deviation'] = 0
        details['peak_price'] = 0
        details['peak_volume'] = 0
        details['valley_price'] = 0
        details['valley_volume'] = 0
        details['num_peaks'] = 0
        details['num_valleys'] = 0
    
    return details

def plot_potential_stock(df, stock_code, details):
    """绘制潜在股票的形态图"""
    dec_2025 = df[df['date'].dt.year == 2025]
    if len(dec_2025) == 0:
        return
    
    dec_start = dec_2025[dec_2025['date'].dt.month == 12]['date'].min()
    if pd.isna(dec_start):
        return
    
    analysis_start = dec_start - pd.Timedelta(days=90)
    dec_end = dec_2025['date'].max()
    
    df_analysis = df[(df['date'] >= analysis_start) & (df['date'] <= dec_end)].copy()
    
    if len(df_analysis) < 50:
        return
    
    df_analysis['ma5'] = df_analysis['close'].rolling(window=5).mean()
    df_analysis['ma10'] = df_analysis['close'].rolling(window=10).mean()
    df_analysis['ma20'] = df_analysis['close'].rolling(window=20).mean()
    df_analysis['ma60'] = df_analysis['close'].rolling(window=60).mean()
    df_analysis['volume_ma5'] = df_analysis['volume'].rolling(window=5).mean()
    
    df_pre = df_analysis[df_analysis['date'] < dec_start].copy()
    
    if len(df_pre) >= 30:
        x_pre = np.arange(len(df_pre))
        y_pre = df_pre['close'].values
        z = np.polyfit(x_pre, y_pre, 1)
        slope = z[0]
        intercept = z[1]
        trend_line_pre = slope * x_pre + intercept
        residuals = y_pre - trend_line_pre
        std_residuals = np.std(residuals)
        
        x_all = np.arange(len(df_analysis))
        trend_line_all = slope * x_all + intercept
        channel_upper = trend_line_all + std_residuals
        channel_lower = trend_line_all - std_residuals
    else:
        trend_line_all = None
        channel_upper = None
        channel_lower = None
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(16, 10))
    
    ax1.plot(df_analysis['date'], df_analysis['close'], label='收盘价', linewidth=1.5, color='black')
    ax1.plot(df_analysis['date'], df_analysis['ma5'], label='MA5', linewidth=1, alpha=0.7, color='red')
    ax1.plot(df_analysis['date'], df_analysis['ma10'], label='MA10', linewidth=1, alpha=0.7, color='orange')
    ax1.plot(df_analysis['date'], df_analysis['ma20'], label='MA20', linewidth=1, alpha=0.7, color='blue')
    ax1.plot(df_analysis['date'], df_analysis['ma60'], label='MA60', linewidth=1, alpha=0.7, color='green')
    
    if trend_line_all is not None:
        ax1.plot(df_analysis['date'], trend_line_all, label='通道趋势线', linewidth=2, color='purple', linestyle='--')
        ax1.fill_between(df_analysis['date'], channel_lower, channel_upper, 
                        alpha=0.15, color='purple', label='上升通道')
    
    ax1.axvline(x=dec_start, color='red', linestyle='--', linewidth=2, label='12月开始')
    ax1.axvspan(dec_start, dec_end, alpha=0.1, color='red')
    
    title_text = f'{stock_code} 潜在主升股票分析\n'
    title_text += f'12月涨幅: {details["december_gain"]:.2f}% | 价格位置: {details["price_position"]:.1f}% | '
    title_text += f'量能变化: {details["volume_change"]:.2f}倍 | 通道斜率: {details["slope"]:.4f}\n'
    title_text += f'筹码集中度: {details["chip_concentration"]:.1f}% | 筹码位置: {details["chip_position"]} | '
    title_text += f'获利比例: {details["profit_ratio"]:.1f}% | 平均成本: {details["avg_cost"]:.2f}'
    ax1.set_title(title_text, fontsize=11, fontweight='bold')
    ax1.set_ylabel('价格', fontsize=12)
    ax1.legend(loc='upper left', fontsize=9)
    ax1.grid(True, alpha=0.3)
    
    if 'open' in df_analysis.columns:
        colors = ['red' if df_analysis['close'].iloc[i] >= df_analysis['open'].iloc[i] else 'green' 
                  for i in range(len(df_analysis))]
    else:
        colors = ['red' if i > 0 and df_analysis['close'].iloc[i] >= df_analysis['close'].iloc[i-1] else 'green' 
                  for i in range(len(df_analysis))]
    ax2.bar(df_analysis['date'], df_analysis['volume'], color=colors, alpha=0.6, width=1)
    ax2.plot(df_analysis['date'], df_analysis['volume_ma5'], label='量能MA5', linewidth=1.5, color='blue')
    ax2.axvline(x=dec_start, color='red', linestyle='--', linewidth=2)
    ax2.axvspan(dec_start, dec_end, alpha=0.1, color='red')
    ax2.set_ylabel('成交量', fontsize=12)
    ax2.set_xlabel('日期', fontsize=12)
    ax2.legend(loc='upper left', fontsize=9)
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    filename = f'{stock_code.replace("#", "_")}_潜在主升.png'
    plt.savefig(filename, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"  已保存: {filename}")

def main():
    """主函数：筛选符合上升通道+低位+缩量但未启动主升的股票"""
    print("=" * 80)
    print("筛选符合上升通道+低位+缩量但未启动主升的股票")
    print("=" * 80)
    
    data_dir = 'data'
    if not os.path.exists(data_dir):
        print(f"数据目录不存在: {data_dir}")
        return
    
    txt_files = glob.glob(os.path.join(data_dir, '*.txt'))
    print(f"\n找到 {len(txt_files)} 个股票数据文件")
    
    all_results = []
    rising_channel_count = 0
    
    for file_path in txt_files:
        stock_code = os.path.basename(file_path).replace('.txt', '')
        
        df = load_and_clean_data(file_path)
        if df is None:
            continue
        
        details = analyze_stock(df, stock_code)
        if details:
            rising_channel_count += 1
            all_results.append(details)
    
    print(f"\n检测到上升通道形态的股票: {rising_channel_count} 只")
    
    if not all_results:
        print("未找到符合条件的股票")
        return
    
    df_results = pd.DataFrame(all_results)
    
    print(f"\n筛选条件:")
    print(f"  - 上升通道: 是")
    print(f"  - 价格位置 < 30% (低位)")
    print(f"  - 量能变化 < 0.8倍 (缩量)")
    print(f"  - 12月涨幅 < 20% (未启动主升)")
    
    filtered = df_results[
        (df_results['price_position'] < 30) &
        (df_results['volume_change'] < 0.8) &
        (df_results['december_gain'] < 20)
    ].copy()
    
    print(f"\n符合条件股票数量: {len(filtered)} 只")
    
    if len(filtered) == 0:
        print("未找到完全符合条件的股票，放宽条件...")
        filtered = df_results[
            (df_results['price_position'] < 40) &
            (df_results['volume_change'] < 1.0) &
            (df_results['december_gain'] < 30)
        ].copy()
        print(f"放宽条件后符合数量: {len(filtered)} 只")
    
    if len(filtered) == 0:
        print("仍然未找到符合条件的股票")
        return
    
    filtered = filtered.sort_values('december_gain', ascending=True).reset_index(drop=True)
    
    print("\n" + "=" * 80)
    print("符合条件的股票列表:")
    print("=" * 80)
    
    for idx, row in filtered.iterrows():
        print(f"\n【{row['stock_code']}】")
        print(f"  12月涨幅: {row['december_gain']:.2f}%")
        print(f"  价格位置: {row['price_position']:.1f}%")
        print(f"  量能变化: {row['volume_change']:.2f}倍")
        print(f"  通道斜率: {row['slope']:.4f}")
        print(f"  均线趋势: {row['ma_trend']}")
        print(f"  启动前涨幅: {row['pre_gain']:.2f}%")
        print(f"  波动幅度: {row['pre_volatility']:.2f}%")
        print(f"  筹码集中度: {row['chip_concentration']:.1f}%")
        print(f"  筹码状态: {row['chip_status']}")
        print(f"  筹码位置: {row['chip_position']}")
        print(f"  获利比例: {row['profit_ratio']:.1f}%")
        print(f"  平均成本: {row['avg_cost']:.2f}")
        print(f"  主力成本区: {row['peak_price']:.2f}")
        print(f"  阻力区: {row['valley_price']:.2f}")
    
    print("\n" + "=" * 80)
    print("统计信息:")
    print("=" * 80)
    print(f"平均12月涨幅: {filtered['december_gain'].mean():.2f}%")
    print(f"平均价格位置: {filtered['price_position'].mean():.1f}%")
    print(f"平均量能变化: {filtered['volume_change'].mean():.2f}倍")
    print(f"平均通道斜率: {filtered['slope'].mean():.4f}")
    print(f"平均筹码集中度: {filtered['chip_concentration'].mean():.1f}%")
    print(f"平均获利比例: {filtered['profit_ratio'].mean():.1f}%")
    print(f"平均成本偏离度: {filtered['cost_deviation'].mean():.2f}%")
    
    ma_trend_counts = filtered['ma_trend'].value_counts()
    print(f"\n均线趋势分布:")
    for trend, count in ma_trend_counts.items():
        print(f"  {trend}: {count}/{len(filtered)} ({count/len(filtered)*100:.1f}%)")
    
    chip_status_counts = filtered['chip_status'].value_counts()
    print(f"\n筹码状态分布:")
    for status, count in chip_status_counts.items():
        print(f"  {status}: {count}/{len(filtered)} ({count/len(filtered)*100:.1f}%)")
    
    chip_position_counts = filtered['chip_position'].value_counts()
    print(f"\n筹码位置分布:")
    for position, count in chip_position_counts.items():
        print(f"  {position}: {count}/{len(filtered)} ({count/len(filtered)*100:.1f}%)")
    
    output_file = '上升通道低位缩量潜在主升股票_full.xlsx'
    filtered.to_excel(output_file, index=False)
    print(f"\n详细结果已保存到: {output_file}")
    
    print("\n" + "=" * 80)
    print("生成可视化图表...")
    print("=" * 80)
    
    for idx, row in filtered.head(20).iterrows():
        stock_code = row['stock_code']
        file_path = os.path.join(data_dir, f'{stock_code}.txt')
        
        df = load_and_clean_data(file_path)
        if df is not None:
            plot_potential_stock(df, stock_code, row)
    
    print(f"\n已生成前20只股票的可视化图表")
    print("\n分析完成！")

if __name__ == '__main__':
    main()
