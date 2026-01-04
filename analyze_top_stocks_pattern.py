import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
import glob
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# 设置matplotlib中文字体
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

def plot_chip_distribution(df, stock_code, chip_stats):
    """绘制筹码分布图"""
    if chip_stats is None or 'distribution' not in chip_stats:
        return
    
    distribution = chip_stats['distribution']
    
    # 创建图表
    fig, ax = plt.subplots(figsize=(14, 8))
    
    # 提取价格和筹码量
    prices = [item['price_mid'] for item in distribution]
    volumes = [item['volume'] for item in distribution]
    
    # 绘制筹码分布柱状图
    colors = []
    for i in range(len(distribution)):
        if i == 0:
            colors.append('green')
        elif i == len(distribution) - 1:
            colors.append('red')
        else:
            if distribution[i]['volume'] > distribution[i-1]['volume'] and distribution[i]['volume'] > distribution[i+1]['volume']:
                colors.append('orange')
            elif distribution[i]['volume'] < distribution[i-1]['volume'] and distribution[i]['volume'] < distribution[i+1]['volume']:
                colors.append('blue')
            else:
                colors.append('gray')
    
    bars = ax.bar(range(len(distribution)), volumes, color=colors, alpha=0.7, edgecolor='black', linewidth=0.5)
    
    # 设置x轴标签为价格
    ax.set_xticks(range(len(distribution)))
    ax.set_xticklabels([f'{p:.2f}' for p in prices], rotation=45, ha='right')
    
    # 标注筹码峰和谷
    for i, item in enumerate(distribution):
        if item in chip_stats['peaks']:
            ax.annotate('峰', xy=(i, item['volume']), xytext=(0, 10),
                       textcoords='offset points', ha='center', va='bottom',
                       fontsize=10, fontweight='bold', color='red')
        elif item in chip_stats['valleys']:
            ax.annotate('谷', xy=(i, item['volume']), xytext=(0, -15),
                       textcoords='offset points', ha='center', va='top',
                       fontsize=10, fontweight='bold', color='blue')
    
    # 标注当前价格
    current_price = df.iloc[-1]['close']
    ax.axhline(y=0, color='black', linestyle='-', linewidth=0.5)
    ax.set_title(f'{stock_code} 筹码分布图\n筹码集中度: {chip_stats["concentration"]:.2f}% | 获利比例: {chip_stats.get("profit_ratio", 0):.2f}%', 
                fontsize=14, fontweight='bold')
    ax.set_xlabel('价格', fontsize=12)
    ax.set_ylabel('筹码量（成交量）', fontsize=12)
    ax.grid(True, alpha=0.3, axis='y')
    
    # 添加图例
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='orange', label='筹码峰（主力成本区）'),
        Patch(facecolor='blue', label='筹码谷（阻力区）'),
        Patch(facecolor='green', label='低位'),
        Patch(facecolor='red', label='高位'),
        Patch(facecolor='gray', label='其他')
    ]
    ax.legend(handles=legend_elements, loc='upper right', fontsize=10)
    
    plt.tight_layout()
    
    # 保存图片
    filename = f'{stock_code.replace("#", "_")}_筹码分布.png'
    plt.savefig(filename, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"  已保存: {filename}")

def plot_stock_pattern(df, stock_code, gain, chip_stats=None):
    """绘制股票启动形态图"""
    # 找到2025年12月的第一天
    dec_2025 = df[df['date'].dt.year == 2025]
    if len(dec_2025) == 0:
        return
    
    dec_start = dec_2025[dec_2025['date'].dt.month == 12]['date'].min()
    if pd.isna(dec_start):
        return
    
    # 获取分析区间：12月前180天到12月底
    analysis_start = dec_start - pd.Timedelta(days=180)
    dec_end = df[df['date'].dt.year == 2025]['date'].max()
    
    df_analysis = df[(df['date'] >= analysis_start) & (df['date'] <= dec_end)].copy()
    
    if len(df_analysis) < 50:
        return
    
    # 计算技术指标
    df_analysis['ma5'] = df_analysis['close'].rolling(window=5).mean()
    df_analysis['ma10'] = df_analysis['close'].rolling(window=10).mean()
    df_analysis['ma20'] = df_analysis['close'].rolling(window=20).mean()
    df_analysis['ma60'] = df_analysis['close'].rolling(window=60).mean()
    df_analysis['volume_ma5'] = df_analysis['volume'].rolling(window=5).mean()
    
    # 检测启动前的形态
    pre_dec = df_analysis[df_analysis['date'] < dec_start]
    patterns = []
    pattern_markers = []
    
    if len(pre_dec) >= 20:
        n_pattern = detect_n_pattern(pre_dec)
        if n_pattern:
            patterns.append(n_pattern)
            markers = get_n_pattern_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
        
        v_pattern = detect_v_pattern(pre_dec)
        if v_pattern:
            patterns.append(v_pattern)
            markers = get_v_pattern_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
        
        w_pattern = detect_w_pattern(pre_dec)
        if w_pattern:
            patterns.append(w_pattern)
            markers = get_w_pattern_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
        
        head_shoulder = detect_head_shoulder_bottom(pre_dec)
        if head_shoulder:
            patterns.append(head_shoulder)
            markers = get_head_shoulder_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
        
        triangle = detect_triangle_pattern(pre_dec)
        if triangle:
            patterns.append(triangle)
            markers = get_triangle_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
        
        box = detect_box_pattern(pre_dec)
        if box:
            patterns.append(box)
            markers = get_box_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
        
        rising = detect_rising_channel(pre_dec)
        if rising:
            patterns.append(rising)
            markers = get_rising_channel_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
        
        falling = detect_falling_channel(pre_dec)
        if falling:
            patterns.append(falling)
            markers = get_falling_channel_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
        
        rounding = detect_rounding_bottom(pre_dec)
        if rounding:
            patterns.append(rounding)
            markers = get_rounding_bottom_markers(pre_dec)
            if markers:
                pattern_markers.extend(markers)
    
    pattern_text = ' | '.join(patterns) if patterns else '无明显形态'
    
    # 创建图表
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(16, 10))
    
    # 绘制价格图
    ax1.plot(df_analysis['date'], df_analysis['close'], label='收盘价', linewidth=1.5, color='black')
    ax1.plot(df_analysis['date'], df_analysis['ma5'], label='MA5', linewidth=1, alpha=0.7, color='red')
    ax1.plot(df_analysis['date'], df_analysis['ma10'], label='MA10', linewidth=1, alpha=0.7, color='orange')
    ax1.plot(df_analysis['date'], df_analysis['ma20'], label='MA20', linewidth=1, alpha=0.7, color='blue')
    ax1.plot(df_analysis['date'], df_analysis['ma60'], label='MA60', linewidth=1, alpha=0.7, color='green')
    
    # 标注形态关键点
    for marker in pattern_markers:
        marker_type = marker['type']
        
        if marker_type == 'point':
            date = marker['date']
            price = marker['price']
            label = marker['label']
            ax1.plot(date, price, 'o', markersize=8, markerfacecolor='yellow', 
                    markeredgecolor='red', markeredgewidth=2, zorder=5)
            ax1.annotate(label, (date, price), xytext=(10, 10), 
                        textcoords='offset points', fontsize=9, 
                        bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.7),
                        arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0'))
        elif marker_type == 'line':
            ax1.plot([marker['x1'], marker['x2']], [marker['y1'], marker['y2']], 
                    color=marker.get('color', 'blue'), linestyle=marker.get('linestyle', '--'),
                    linewidth=2, alpha=0.7, label=marker.get('label', ''))
        elif marker_type == 'hline':
            price = marker['price']
            ax1.axhline(y=price, color=marker.get('color', 'blue'), 
                       linestyle=marker.get('linestyle', '--'), linewidth=2, 
                       alpha=0.7, label=marker.get('label', ''))
        elif marker_type == 'vline':
            date = marker['date']
            ax1.axvline(x=date, color=marker.get('color', 'blue'), 
                       linestyle=marker.get('linestyle', '--'), linewidth=2, 
                       alpha=0.7, label=marker.get('label', ''))
        elif marker_type == 'fill':
            ax1.fill_between(marker['x'], marker['y1'], marker['y2'], 
                            alpha=0.2, color=marker.get('color', 'blue'), 
                            label=marker.get('label', ''))
    
    # 标注12月开始
    ax1.axvline(x=dec_start, color='red', linestyle='--', linewidth=2, label='12月开始')
    ax1.axvspan(dec_start, dec_end, alpha=0.1, color='red')
    
    # 标注启动时间点（价格突破前期高点的那一天）
    dec_data = df_analysis[df_analysis['date'] >= dec_start]
    if len(dec_data) > 0 and len(pre_dec) > 0:
        # 找到启动前180天的最高点作为阻力位
        pre_high = pre_dec['high'].max()
        
        # 找到12月期间突破前期高点的第一天
        breakthrough_idx = None
        for i in range(len(dec_data)):
            if dec_data.iloc[i]['high'] > pre_high:
                breakthrough_idx = dec_data.index[i]
                break
        
        if breakthrough_idx is not None:
            launch_date = df_analysis.loc[breakthrough_idx, 'date']
            launch_price = df_analysis.loc[breakthrough_idx, 'close']
            # 计算从启动点到12月底的涨幅
            dec_end_price = dec_data.iloc[-1]['close']
            launch_gain = (dec_end_price - launch_price) / launch_price * 100
            
            # 在图表上标记启动点
            ax1.plot(launch_date, launch_price, '*', markersize=20, markerfacecolor='gold', 
                    markeredgecolor='red', markeredgewidth=2, zorder=6, label='启动点')
            ax1.annotate(f'启动点\n{launch_date.strftime("%Y-%m-%d")}\n价格: {launch_price:.2f}', 
                        (launch_date, launch_price), xytext=(10, -30), 
                        textcoords='offset points', fontsize=10, fontweight='bold',
                        bbox=dict(boxstyle='round,pad=0.5', facecolor='gold', alpha=0.8),
                        arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0', lw=2, color='red'))
            
            # 标注前期高点（阻力位）
            ax1.axhline(y=pre_high, color='orange', linestyle='--', linewidth=1.5, alpha=0.7, label='前期高点')
        else:
            # 如果没有突破前期高点，找到12月期间涨幅最大的那一天
            dec_data = dec_data.copy()
            dec_data['cumulative_gain'] = (dec_data['close'] - dec_data['close'].iloc[0]) / dec_data['close'].iloc[0] * 100
            max_gain_idx = dec_data['cumulative_gain'].idxmax()
            launch_date = dec_data.loc[max_gain_idx, 'date']
            launch_price = dec_data.loc[max_gain_idx, 'close']
            launch_gain = dec_data.loc[max_gain_idx, 'cumulative_gain']
            
            # 在图表上标记启动点
            ax1.plot(launch_date, launch_price, '*', markersize=20, markerfacecolor='gold', 
                    markeredgecolor='red', markeredgewidth=2, zorder=6, label='启动点')
            ax1.annotate(f'启动点\n{launch_date.strftime("%Y-%m-%d")}\n涨幅: {launch_gain:.2f}%', 
                        (launch_date, launch_price), xytext=(10, -30), 
                        textcoords='offset points', fontsize=10, fontweight='bold',
                        bbox=dict(boxstyle='round,pad=0.5', facecolor='gold', alpha=0.8),
                        arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0', lw=2, color='red'))
    
    # 标注启动前横盘区间（如果有）
    if len(pre_dec) > 30:
        volatility = (pre_dec['high'].max() - pre_dec['low'].min()) / pre_dec['low'].min()
        if volatility < 0.3:
            pre_dec_end_idx = len(pre_dec) - 1
            total_len = len(df_analysis)
            ax1.axhspan(pre_dec['low'].min(), pre_dec['high'].max(), 
               xmin=0, xmax=pre_dec_end_idx/total_len, alpha=0.1, color='gray', label='横盘区间')
    
    # 添加筹码信息到图表
    if chip_stats:
        chip_text = f"筹码集中度: {chip_stats.get('chip_concentration', 0):.1f}% | "
        chip_text += f"筹码位置: {chip_stats.get('chip_position', '未知')} | "
        chip_text += f"获利比例: {chip_stats.get('profit_ratio', 0):.1f}% | "
        chip_text += f"平均成本: {chip_stats.get('avg_cost', 0):.2f}"
        
        # 在图表顶部添加筹码信息文本框
        ax1.text(0.02, 0.98, chip_text, transform=ax1.transAxes, 
                fontsize=10, verticalalignment='top',
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))
        
        # 在图表上标记主力成本区
        peak_price = chip_stats.get('peak_price', 0)
        if peak_price > 0:
            ax1.axhline(y=peak_price, color='purple', linestyle='-.', linewidth=2, 
                       alpha=0.7, label=f'主力成本区 {peak_price:.2f}')
        
        # 在图表上标记阻力区
        valley_price = chip_stats.get('valley_price', 0)
        if valley_price > 0:
            ax1.axhline(y=valley_price, color='cyan', linestyle='-.', linewidth=2, 
                       alpha=0.7, label=f'阻力区 {valley_price:.2f}')
    
    ax1.set_title(f'{stock_code} 启动形态分析 (12月涨幅: {gain:.2f}%)\n检测形态: {pattern_text}', fontsize=14, fontweight='bold')
    ax1.set_ylabel('价格', fontsize=12)
    ax1.legend(loc='upper left', fontsize=9, ncol=2)
    ax1.grid(True, alpha=0.3)
    
    # 绘制成交量图
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
    
    # 保存图片
    filename = f'{stock_code.replace("#", "_")}_启动形态.png'
    plt.savefig(filename, dpi=150, bbox_inches='tight')
    plt.close()
    
    print(f"  已保存: {filename}")

def calculate_chip_distribution(df, window=60):
    """计算筹码分布"""
    if len(df) < window:
        return None
    
    recent = df.tail(window).copy()
    
    # 创建价格区间
    price_min = recent['low'].min()
    price_max = recent['high'].max()
    price_range = price_max - price_min
    
    if price_range == 0:
        return None
    
    # 分为20个价格区间
    num_bins = 20
    bin_size = price_range / num_bins
    bins = [price_min + i * bin_size for i in range(num_bins + 1)]
    
    # 计算每个价格区间的筹码量（基于成交量）
    chip_distribution = []
    for i in range(num_bins):
        bin_low = bins[i]
        bin_high = bins[i + 1]
        
        # 计算在这个价格区间内的成交量
        mask = (recent['low'] <= bin_high) & (recent['high'] >= bin_low)
        bin_volume = recent[mask]['volume'].sum()
        
        # 计算加权平均价格
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
    
    # 计算筹码集中度（前3个最大筹码区间的占比）
    total_volume = sum(item['volume'] for item in chip_distribution)
    sorted_chips = sorted(chip_distribution, key=lambda x: x['volume'], reverse=True)
    top3_volume = sum(item['volume'] for item in sorted_chips[:3])
    concentration = (top3_volume / total_volume * 100) if total_volume > 0 else 0
    
    # 找到筹码峰谷
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
    
    # 使用最近60天的数据计算筹码分布
    recent = df.tail(60).copy()
    
    # 计算每个交易日的平均成本
    recent['avg_cost'] = (recent['high'] + recent['low'] + recent['close']) / 3
    
    # 计算获利比例（成本低于当前价格的成交量占比）
    profit_volume = recent[recent['avg_cost'] < current_price]['volume'].sum()
    total_volume = recent['volume'].sum()
    
    profit_ratio = (profit_volume / total_volume * 100) if total_volume > 0 else 0
    
    # 计算平均成本
    avg_cost = (recent['avg_cost'] * recent['volume']).sum() / total_volume if total_volume > 0 else current_price
    
    # 计算成本偏离度
    cost_deviation = ((current_price - avg_cost) / avg_cost * 100) if avg_cost > 0 else 0
    
    return {
        'profit_ratio': round(profit_ratio, 2),
        'avg_cost': round(avg_cost, 2),
        'cost_deviation': round(cost_deviation, 2),
        'current_price': round(current_price, 2)
    }

def analyze_chip_statistics(df, stock_code):
    """分析筹码统计"""
    if len(df) < 60:
        return None
    
    # 计算筹码分布
    chip_dist = calculate_chip_distribution(df, window=60)
    if chip_dist is None:
        return None
    
    # 计算筹码获利比例
    chip_profit = calculate_chip_profit_ratio(df)
    
    # 分析筹码峰谷
    peaks = chip_dist['peaks']
    valleys = chip_dist['valleys']
    
    # 找到最大的筹码峰（主力成本区）
    max_peak = max(peaks, key=lambda x: x['volume']) if peaks else None
    
    # 找到最大的筹码谷（阻力区）
    max_valley = max(valleys, key=lambda x: x['volume']) if valleys else None
    
    # 判断筹码状态
    concentration = chip_dist['concentration']
    if concentration > 70:
        chip_status = '高度集中'
    elif concentration > 50:
        chip_status = '中度集中'
    elif concentration > 30:
        chip_status = '分散'
    else:
        chip_status = '极度分散'
    
    # 判断筹码位置
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
        'profit_ratio': chip_profit['profit_ratio'] if chip_profit else 0,
        'avg_cost': chip_profit['avg_cost'] if chip_profit else 0,
        'cost_deviation': chip_profit['cost_deviation'] if chip_profit else 0,
        'peak_price': max_peak['price_mid'] if max_peak else 0,
        'peak_volume': max_peak['volume'] if max_peak else 0,
        'valley_price': max_valley['price_mid'] if max_valley else 0,
        'valley_volume': max_valley['volume'] if max_valley else 0,
        'num_peaks': len(peaks),
        'num_valleys': len(valleys)
    }

def analyze_pattern_details(df, stock_code):
    """详细分析启动形态"""
    dec_2025 = df[df['date'].dt.year == 2025]
    if len(dec_2025) == 0:
        return None
    
    dec_start = dec_2025[dec_2025['date'].dt.month == 12]['date'].min()
    if pd.isna(dec_start):
        return None
    
    # 启动前180天
    pre_start = dec_start - pd.Timedelta(days=180)
    df_pre = df[(df['date'] >= pre_start) & (df['date'] < dec_start)].copy()
    
    if len(df_pre) < 30:
        return None
    
    # 计算技术指标
    df_pre['ma5'] = df_pre['close'].rolling(window=5).mean()
    df_pre['ma10'] = df_pre['close'].rolling(window=10).mean()
    df_pre['ma20'] = df_pre['close'].rolling(window=20).mean()
    df_pre['volume_ma5'] = df_pre['volume'].rolling(window=5).mean()
    
    # 分析关键特征
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
        'pre_volatility': round((df_pre['high'].max() - df_pre['low'].min()) / df_pre['low'].min() * 100, 2),
        'is_consolidation': (df_pre['high'].max() - df_pre['low'].min()) / df_pre['low'].min() < 0.3,
        'avg_volume': round(df_pre['volume'].mean(), 0),
        'max_volume': round(df_pre['volume'].max(), 0),
        'min_volume': round(df_pre['volume'].min(), 0),
    }
    
    # 均线分析
    ma5 = df_pre['ma5'].iloc[-1]
    ma10 = df_pre['ma10'].iloc[-1]
    ma20 = df_pre['ma20'].iloc[-1]
    
    if not pd.isna(ma5) and not pd.isna(ma10) and not pd.isna(ma20):
        if ma5 > ma10 > ma20:
            details['ma_trend'] = '多头排列'
        elif ma5 < ma10 < ma20:
            details['ma_trend'] = '空头排列'
        else:
            details['ma_trend'] = '缠绕'
    else:
        details['ma_trend'] = '数据不足'
    
    # 量能变化
    recent_vol = df_pre.tail(10)['volume'].mean()
    early_vol = df_pre.head(30)['volume'].mean()
    details['volume_change'] = round(recent_vol / early_vol if early_vol > 0 else 1, 2)
    
    # 价格位置
    current_price = df_pre.iloc[-1]['close']
    price_range = df_pre['high'].max() - df_pre['low'].min()
    if price_range > 0:
        details['price_position'] = round((current_price - df_pre['low'].min()) / price_range * 100, 2)
    else:
        details['price_position'] = 50
    
    # 检测多种形态
    patterns = []
    
    n_pattern = detect_n_pattern(df_pre)
    if n_pattern:
        patterns.append(n_pattern)
    
    v_pattern = detect_v_pattern(df_pre)
    if v_pattern:
        patterns.append(v_pattern)
    
    w_pattern = detect_w_pattern(df_pre)
    if w_pattern:
        patterns.append(w_pattern)
    
    head_shoulder = detect_head_shoulder_bottom(df_pre)
    if head_shoulder:
        patterns.append(head_shoulder)
    
    triangle = detect_triangle_pattern(df_pre)
    if triangle:
        patterns.append(triangle)
    
    box = detect_box_pattern(df_pre)
    if box:
        patterns.append(box)
    
    rising = detect_rising_channel(df_pre)
    if rising:
        patterns.append(rising)
    
    falling = detect_falling_channel(df_pre)
    if falling:
        patterns.append(falling)
    
    rounding = detect_rounding_bottom(df_pre)
    if rounding:
        patterns.append(rounding)
    
    details['patterns'] = patterns if patterns else ['无明显形态']
    
    # 识别启动时间点（价格突破前期高点的那一天）
    dec_data = df[df['date'].dt.year == 2025]
    if len(dec_data) > 0 and len(df_pre) > 0:
        # 找到启动前180天的最高点作为阻力位
        pre_high = df_pre['high'].max()
        
        # 找到12月期间突破前期高点的第一天
        breakthrough_idx = None
        for i in range(len(dec_data)):
            if dec_data.iloc[i]['high'] > pre_high:
                breakthrough_idx = dec_data.index[i]
                break
        
        if breakthrough_idx is not None:
            launch_date = dec_data.loc[breakthrough_idx, 'date']
            launch_price = dec_data.loc[breakthrough_idx, 'close']
            # 计算从启动点到12月底的涨幅
            dec_end_price = dec_data.iloc[-1]['close']
            launch_gain = (dec_end_price - launch_price) / launch_price * 100
            
            details['launch_date'] = launch_date.strftime('%Y-%m-%d')
            details['launch_price'] = round(launch_price, 2)
            details['launch_gain'] = round(launch_gain, 2)
            details['breakthrough'] = True
        else:
            # 如果没有突破前期高点，找到12月期间涨幅最大的那一天
            dec_data = dec_data.copy()
            dec_data['cumulative_gain'] = (dec_data['close'] - dec_data['close'].iloc[0]) / dec_data['close'].iloc[0] * 100
            max_gain_idx = dec_data['cumulative_gain'].idxmax()
            launch_date = dec_data.loc[max_gain_idx, 'date']
            launch_price = dec_data.loc[max_gain_idx, 'close']
            launch_gain = dec_data.loc[max_gain_idx, 'cumulative_gain']
            
            details['launch_date'] = launch_date.strftime('%Y-%m-%d')
            details['launch_price'] = round(launch_price, 2)
            details['launch_gain'] = round(launch_gain, 2)
            details['breakthrough'] = False
    else:
        details['launch_date'] = '无数据'
        details['launch_price'] = 0
        details['launch_gain'] = 0
        details['breakthrough'] = False
    
    # 筹码统计
    chip_stats = analyze_chip_statistics(df_pre, stock_code)
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
    
    # 计算筹码分布用于绘图
    chip_dist = calculate_chip_distribution(df_pre, window=60)
    details['chip_distribution'] = chip_dist
    
    return details

def detect_n_pattern(df):
    """检测N型结构"""
    if len(df) < 20:
        return None
    
    try:
        n = 5
        local_max_idx = []
        local_min_idx = []
        
        for i in range(n, len(df) - n):
            is_max = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] <= df['close'].iloc[j]:
                    is_max = False
                    break
            if is_max:
                local_max_idx.append(i)
            
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
        
        if len(local_max_idx) < 2 or len(local_min_idx) < 2:
            return None
        
        if len(local_min_idx) >= 2 and len(local_max_idx) >= 2:
            s1_idx = local_min_idx[-2]
            h1_idx = local_max_idx[-2]
            s2_idx = local_min_idx[-1]
            h2_idx = local_max_idx[-1]
            
            if s1_idx < h1_idx < s2_idx < h2_idx:
                s1 = df.iloc[s1_idx]['close']
                h1 = df.iloc[h1_idx]['close']
                s2 = df.iloc[s2_idx]['close']
                h2 = df.iloc[h2_idx]['close']
                
                if s2 > s1 and h2 > h1:
                    first_wave = h1 - s1
                    if first_wave > 0:
                        retracement = (h1 - s2) / first_wave
                        if retracement < 0.5:
                            return f'N型 (回调{retracement*100:.1f}%)'
        
        return None
    except Exception as e:
        return None

def detect_v_pattern(df):
    """检测V型反转形态"""
    if len(df) < 20:
        return None
    
    try:
        n = 5
        local_min_idx = []
        
        for i in range(n, len(df) - n):
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
        
        if len(local_min_idx) < 1:
            return None
        
        min_idx = local_min_idx[-1]
        min_price = df.iloc[min_idx]['close']
        
        if min_idx < 10 or min_idx > len(df) - 10:
            return None
        
        before_low = df.iloc[:min_idx]['close'].min()
        after_high = df.iloc[min_idx:]['close'].max()
        
        drop_ratio = (before_low - min_price) / before_low if before_low > 0 else 0
        rise_ratio = (after_high - min_price) / min_price if min_price > 0 else 0
        
        if drop_ratio > 0.15 and rise_ratio > 0.15:
            return f'V型反转 (下跌{drop_ratio*100:.1f}%, 上涨{rise_ratio*100:.1f}%)'
        
        return None
    except Exception as e:
        return None

def detect_w_pattern(df):
    """检测W型双底形态"""
    if len(df) < 30:
        return None
    
    try:
        n = 5
        local_min_idx = []
        local_max_idx = []
        
        for i in range(n, len(df) - n):
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
            
            is_max = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] <= df['close'].iloc[j]:
                    is_max = False
                    break
            if is_max:
                local_max_idx.append(i)
        
        if len(local_min_idx) < 2 or len(local_max_idx) < 1:
            return None
        
        s1_idx = local_min_idx[-2]
        h_idx = local_max_idx[-1]
        s2_idx = local_min_idx[-1]
        
        if not (s1_idx < h_idx < s2_idx):
            return None
        
        s1 = df.iloc[s1_idx]['close']
        h = df.iloc[h_idx]['close']
        s2 = df.iloc[s2_idx]['close']
        
        price_diff = abs(s1 - s2) / min(s1, s2) if min(s1, s2) > 0 else 1
        
        if price_diff < 0.05 and h > s1 * 1.1:
            return f'W双底 (两底差{price_diff*100:.1f}%)'
        
        return None
    except Exception as e:
        return None

def detect_head_shoulder_bottom(df):
    """检测头肩底形态"""
    if len(df) < 40:
        return None
    
    try:
        n = 5
        local_min_idx = []
        local_max_idx = []
        
        for i in range(n, len(df) - n):
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
            
            is_max = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] <= df['close'].iloc[j]:
                    is_max = False
                    break
            if is_max:
                local_max_idx.append(i)
        
        if len(local_min_idx) < 3 or len(local_max_idx) < 2:
            return None
        
        l1_idx = local_min_idx[-3]
        h1_idx = local_max_idx[-2]
        h_idx = local_min_idx[-2]
        h2_idx = local_max_idx[-1]
        l2_idx = local_min_idx[-1]
        
        if not (l1_idx < h1_idx < h_idx < h2_idx < l2_idx):
            return None
        
        l1 = df.iloc[l1_idx]['close']
        h1 = df.iloc[h1_idx]['close']
        h = df.iloc[h_idx]['close']
        h2 = df.iloc[h2_idx]['close']
        l2 = df.iloc[l2_idx]['close']
        
        shoulder_diff = abs(l1 - l2) / min(l1, l2) if min(l1, l2) > 0 else 1
        
        if h < l1 and h < l2 and shoulder_diff < 0.05 and h1 > l1 and h2 > l2:
            return f'头肩底 (头比肩低{(min(l1, l2) - h)/min(l1, l2)*100:.1f}%)'
        
        return None
    except Exception as e:
        return None

def detect_triangle_pattern(df):
    """检测三角形整理形态"""
    if len(df) < 30:
        return None
    
    try:
        df_analysis = df.copy()
        df_analysis['ma10'] = df_analysis['close'].rolling(window=10).mean()
        df_analysis['ma20'] = df_analysis['close'].rolling(window=20).mean()
        
        first_half = df_analysis.iloc[:len(df_analysis)//2]
        second_half = df_analysis.iloc[len(df_analysis)//2:]
        
        if len(first_half) < 10 or len(second_half) < 10:
            return None
        
        first_volatility = (first_half['high'].max() - first_half['low'].min()) / first_half['low'].min()
        second_volatility = (second_half['high'].max() - second_half['low'].min()) / second_half['low'].min()
        
        if second_volatility < first_volatility * 0.6:
            if second_volatility < 0.15:
                return f'收敛三角形 (波动缩小{(1-second_volatility/first_volatility)*100:.1f}%)'
        
        return None
    except Exception as e:
        return None

def detect_box_pattern(df):
    """检测箱体震荡形态"""
    if len(df) < 30:
        return None
    
    try:
        volatility = (df['high'].max() - df['low'].min()) / df['low'].min()
        
        if volatility < 0.2:
            upper_bound = df['high'].mean() + df['high'].std()
            lower_bound = df['low'].mean() - df['low'].std()
            
            touch_upper = sum(df['high'] > upper_bound)
            touch_lower = sum(df['low'] < lower_bound)
            
            if touch_upper > 3 and touch_lower > 3:
                return f'箱体震荡 (波动{volatility*100:.1f}%)'
        
        return None
    except Exception as e:
        return None

def detect_rising_channel(df):
    """检测上升通道形态"""
    if len(df) < 30:
        return None
    
    try:
        x = np.arange(len(df))
        y = df['close'].values
        
        z = np.polyfit(x, y, 1)
        slope = z[0]
        
        if slope > 0:
            residuals = y - (slope * x + z[1])
            std_residuals = np.std(residuals)
            
            if std_residuals / np.mean(y) < 0.1:
                return f'上升通道 (斜率{slope:.4f})'
        
        return None
    except Exception as e:
        return None

def detect_falling_channel(df):
    """检测下降通道形态"""
    if len(df) < 30:
        return None
    
    try:
        x = np.arange(len(df))
        y = df['close'].values
        
        z = np.polyfit(x, y, 1)
        slope = z[0]
        
        if slope < 0:
            residuals = y - (slope * x + z[1])
            std_residuals = np.std(residuals)
            
            if std_residuals / np.mean(y) < 0.1:
                return f'下降通道 (斜率{slope:.4f})'
        
        return None
    except Exception as e:
        return None

def detect_rounding_bottom(df):
    """检测圆弧底形态"""
    if len(df) < 40:
        return None
    
    try:
        n = 5
        local_min_idx = []
        
        for i in range(n, len(df) - n):
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
        
        if len(local_min_idx) < 1:
            return None
        
        min_idx = local_min_idx[-1]
        min_price = df.iloc[min_idx]['close']
        
        if min_idx < 20 or min_idx > len(df) - 20:
            return None
        
        before_prices = df.iloc[:min_idx]['close'].values
        after_prices = df.iloc[min_idx:]['close'].values
        
        before_trend = np.polyfit(np.arange(len(before_prices)), before_prices, 1)[0]
        after_trend = np.polyfit(np.arange(len(after_prices)), after_prices, 1)[0]
        
        if before_trend < 0 and after_trend > 0:
            return f'圆弧底 (前斜率{before_trend:.4f}, 后斜率{after_trend:.4f})'
        
        return None
    except Exception as e:
        return None

def get_n_pattern_markers(df):
    """获取N型结构的关键点标记"""
    markers = []
    if len(df) < 20:
        return markers
    
    try:
        n = 5
        local_max_idx = []
        local_min_idx = []
        
        for i in range(n, len(df) - n):
            is_max = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] <= df['close'].iloc[j]:
                    is_max = False
                    break
            if is_max:
                local_max_idx.append(i)
            
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
        
        if len(local_min_idx) >= 2 and len(local_max_idx) >= 2:
            s1_idx = local_min_idx[-2]
            h1_idx = local_max_idx[-2]
            s2_idx = local_min_idx[-1]
            h2_idx = local_max_idx[-1]
            
            if s1_idx < h1_idx < s2_idx < h2_idx:
                s1 = df.iloc[s1_idx]['close']
                h1 = df.iloc[h1_idx]['close']
                s2 = df.iloc[s2_idx]['close']
                h2 = df.iloc[h2_idx]['close']
                
                if s2 > s1 and h2 > h1:
                    first_wave = h1 - s1
                    if first_wave > 0:
                        retracement = (h1 - s2) / first_wave
                        if retracement < 0.5:
                            markers.append({
                                'type': 'point',
                                'date': df.iloc[s1_idx]['date'],
                                'price': s1,
                                'label': '第一底'
                            })
                            markers.append({
                                'type': 'point',
                                'date': df.iloc[h1_idx]['date'],
                                'price': h1,
                                'label': '第一峰'
                            })
                            markers.append({
                                'type': 'point',
                                'date': df.iloc[s2_idx]['date'],
                                'price': s2,
                                'label': '第二底'
                            })
                            markers.append({
                                'type': 'point',
                                'date': df.iloc[h2_idx]['date'],
                                'price': h2,
                                'label': '第二峰'
                            })
        
        return markers
    except Exception as e:
        return markers

def get_v_pattern_markers(df):
    """获取V型反转的关键点标记"""
    markers = []
    if len(df) < 20:
        return markers
    
    try:
        n = 5
        local_min_idx = []
        
        for i in range(n, len(df) - n):
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
        
        if len(local_min_idx) < 1:
            return markers
        
        min_idx = local_min_idx[-1]
        min_price = df.iloc[min_idx]['close']
        
        if min_idx < 10 or min_idx > len(df) - 10:
            return markers
        
        before_low = df.iloc[:min_idx]['close'].min()
        after_high = df.iloc[min_idx:]['close'].max()
        
        drop_ratio = (before_low - min_price) / before_low if before_low > 0 else 0
        rise_ratio = (after_high - min_price) / min_price if min_price > 0 else 0
        
        if drop_ratio > 0.15 and rise_ratio > 0.15:
            markers.append({
                'type': 'point',
                'date': df.iloc[min_idx]['date'],
                'price': min_price,
                'label': 'V底'
            })
        
        return markers
    except Exception as e:
        return markers

def get_w_pattern_markers(df):
    """获取W双底的关键点标记"""
    markers = []
    if len(df) < 30:
        return markers
    
    try:
        n = 5
        local_min_idx = []
        local_max_idx = []
        
        for i in range(n, len(df) - n):
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
            
            is_max = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] <= df['close'].iloc[j]:
                    is_max = False
                    break
            if is_max:
                local_max_idx.append(i)
        
        if len(local_min_idx) < 2 or len(local_max_idx) < 1:
            return markers
        
        s1_idx = local_min_idx[-2]
        h_idx = local_max_idx[-1]
        s2_idx = local_min_idx[-1]
        
        if not (s1_idx < h_idx < s2_idx):
            return markers
        
        s1 = df.iloc[s1_idx]['close']
        h = df.iloc[h_idx]['close']
        s2 = df.iloc[s2_idx]['close']
        
        price_diff = abs(s1 - s2) / min(s1, s2) if min(s1, s2) > 0 else 1
        
        if price_diff < 0.05 and h > s1 * 1.1:
            markers.append({
                'type': 'point',
                'date': df.iloc[s1_idx]['date'],
                'price': s1,
                'label': '左底'
            })
            markers.append({
                'type': 'point',
                'date': df.iloc[h_idx]['date'],
                'price': h,
                'label': '颈线'
            })
            markers.append({
                'type': 'point',
                'date': df.iloc[s2_idx]['date'],
                'price': s2,
                'label': '右底'
            })
        
        return markers
    except Exception as e:
        return markers

def get_head_shoulder_markers(df):
    """获取头肩底的关键点标记"""
    markers = []
    if len(df) < 40:
        return markers
    
    try:
        n = 5
        local_min_idx = []
        local_max_idx = []
        
        for i in range(n, len(df) - n):
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
            
            is_max = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] <= df['close'].iloc[j]:
                    is_max = False
                    break
            if is_max:
                local_max_idx.append(i)
        
        if len(local_min_idx) < 3 or len(local_max_idx) < 2:
            return markers
        
        l1_idx = local_min_idx[-3]
        h1_idx = local_max_idx[-2]
        h_idx = local_min_idx[-2]
        h2_idx = local_max_idx[-1]
        l2_idx = local_min_idx[-1]
        
        if not (l1_idx < h1_idx < h_idx < h2_idx < l2_idx):
            return markers
        
        l1 = df.iloc[l1_idx]['close']
        h1 = df.iloc[h1_idx]['close']
        h = df.iloc[h_idx]['close']
        h2 = df.iloc[h2_idx]['close']
        l2 = df.iloc[l2_idx]['close']
        
        shoulder_diff = abs(l1 - l2) / min(l1, l2) if min(l1, l2) > 0 else 1
        
        if h < l1 and h < l2 and shoulder_diff < 0.05 and h1 > l1 and h2 > l2:
            markers.append({
                'type': 'point',
                'date': df.iloc[l1_idx]['date'],
                'price': l1,
                'label': '左肩'
            })
            markers.append({
                'type': 'point',
                'date': df.iloc[h1_idx]['date'],
                'price': h1,
                'label': '左峰'
            })
            markers.append({
                'type': 'point',
                'date': df.iloc[h_idx]['date'],
                'price': h,
                'label': '头部'
            })
            markers.append({
                'type': 'point',
                'date': df.iloc[h2_idx]['date'],
                'price': h2,
                'label': '右峰'
            })
            markers.append({
                'type': 'point',
                'date': df.iloc[l2_idx]['date'],
                'price': l2,
                'label': '右肩'
            })
        
        return markers
    except Exception as e:
        return markers

def get_triangle_markers(df):
    """获取三角形的关键点标记"""
    markers = []
    if len(df) < 30:
        return markers
    
    try:
        df_analysis = df.copy()
        df_analysis['ma10'] = df_analysis['close'].rolling(window=10).mean()
        df_analysis['ma20'] = df_analysis['close'].rolling(window=20).mean()
        
        first_half = df_analysis.iloc[:len(df_analysis)//2]
        second_half = df_analysis.iloc[len(df_analysis)//2:]
        
        if len(first_half) < 10 or len(second_half) < 10:
            return markers
        
        first_volatility = (first_half['high'].max() - first_half['low'].min()) / first_half['low'].min()
        second_volatility = (second_half['high'].max() - second_half['low'].min()) / second_half['low'].min()
        
        if second_volatility < first_volatility * 0.6:
            if second_volatility < 0.15:
                mid_idx = len(df_analysis) // 2
                markers.append({
                    'type': 'vline',
                    'date': df_analysis.iloc[mid_idx]['date'],
                    'price': df_analysis.iloc[mid_idx]['close'],
                    'label': '收敛点'
                })
        
        return markers
    except Exception as e:
        return markers

def get_box_markers(df):
    """获取箱体的关键点标记"""
    markers = []
    if len(df) < 30:
        return markers
    
    try:
        volatility = (df['high'].max() - df['low'].min()) / df['low'].min()
        
        if volatility < 0.2:
            upper_bound = df['high'].mean() + df['high'].std()
            lower_bound = df['low'].mean() - df['low'].std()
            
            touch_upper = sum(df['high'] > upper_bound)
            touch_lower = sum(df['low'] < lower_bound)
            
            if touch_upper > 3 and touch_lower > 3:
                markers.append({
                    'type': 'hline',
                    'date': df.iloc[0]['date'],
                    'price': upper_bound,
                    'label': '箱体上沿'
                })
                markers.append({
                    'type': 'hline',
                    'date': df.iloc[0]['date'],
                    'price': lower_bound,
                    'label': '箱体下沿'
                })
        
        return markers
    except Exception as e:
        return markers

def get_rising_channel_markers(df):
    """获取上升通道的关键点标记"""
    markers = []
    if len(df) < 30:
        return markers
    
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
                trend_line = slope * x + intercept
                upper_line = trend_line + std_residuals
                lower_line = trend_line - std_residuals
                
                markers.append({
                    'type': 'line',
                    'x1': df.iloc[0]['date'],
                    'y1': trend_line[0],
                    'x2': df.iloc[-1]['date'],
                    'y2': trend_line[-1],
                    'label': '通道趋势线',
                    'color': 'purple',
                    'linestyle': '--'
                })
                markers.append({
                    'type': 'line',
                    'x1': df.iloc[0]['date'],
                    'y1': upper_line[0],
                    'x2': df.iloc[-1]['date'],
                    'y2': upper_line[-1],
                    'label': '通道上轨',
                    'color': 'green',
                    'linestyle': ':'
                })
                markers.append({
                    'type': 'line',
                    'x1': df.iloc[0]['date'],
                    'y1': lower_line[0],
                    'x2': df.iloc[-1]['date'],
                    'y2': lower_line[-1],
                    'label': '通道下轨',
                    'color': 'orange',
                    'linestyle': ':'
                })
        
        return markers
    except Exception as e:
        return markers

def get_falling_channel_markers(df):
    """获取下降通道的关键点标记"""
    markers = []
    if len(df) < 30:
        return markers
    
    try:
        x = np.arange(len(df))
        y = df['close'].values
        
        z = np.polyfit(x, y, 1)
        slope = z[0]
        intercept = z[1]
        
        if slope < 0:
            residuals = y - (slope * x + intercept)
            std_residuals = np.std(residuals)
            
            if std_residuals / np.mean(y) < 0.1:
                trend_line = slope * x + intercept
                upper_line = trend_line + std_residuals
                lower_line = trend_line - std_residuals
                
                markers.append({
                    'type': 'line',
                    'x1': df.iloc[0]['date'],
                    'y1': trend_line[0],
                    'x2': df.iloc[-1]['date'],
                    'y2': trend_line[-1],
                    'label': '通道趋势线',
                    'color': 'purple',
                    'linestyle': '--'
                })
                markers.append({
                    'type': 'line',
                    'x1': df.iloc[0]['date'],
                    'y1': upper_line[0],
                    'x2': df.iloc[-1]['date'],
                    'y2': upper_line[-1],
                    'label': '通道上轨',
                    'color': 'green',
                    'linestyle': ':'
                })
                markers.append({
                    'type': 'line',
                    'x1': df.iloc[0]['date'],
                    'y1': lower_line[0],
                    'x2': df.iloc[-1]['date'],
                    'y2': lower_line[-1],
                    'label': '通道下轨',
                    'color': 'orange',
                    'linestyle': ':'
                })
        
        return markers
    except Exception as e:
        return markers

def get_rounding_bottom_markers(df):
    """获取圆弧底的关键点标记"""
    markers = []
    if len(df) < 40:
        return markers
    
    try:
        n = 5
        local_min_idx = []
        
        for i in range(n, len(df) - n):
            is_min = True
            for j in range(i - n, i + n + 1):
                if j != i and df['close'].iloc[i] >= df['close'].iloc[j]:
                    is_min = False
                    break
            if is_min:
                local_min_idx.append(i)
        
        if len(local_min_idx) < 1:
            return markers
        
        min_idx = local_min_idx[-1]
        min_price = df.iloc[min_idx]['close']
        
        if min_idx < 20 or min_idx > len(df) - 20:
            return markers
        
        before_prices = df.iloc[:min_idx]['close'].values
        after_prices = df.iloc[min_idx:]['close'].values
        
        before_trend = np.polyfit(np.arange(len(before_prices)), before_prices, 1)[0]
        after_trend = np.polyfit(np.arange(len(after_prices)), after_prices, 1)[0]
        
        if before_trend < 0 and after_trend > 0:
            markers.append({
                'type': 'point',
                'date': df.iloc[min_idx]['date'],
                'price': min_price,
                'label': '圆弧底'
            })
        
        return markers
    except Exception as e:
        return markers

def main():
    """主函数：分析涨幅前10名股票的启动形态"""
    # 读取之前的结果
    df_results = pd.read_excel('2025年12月股票涨幅统计.xlsx')
    top_stocks = df_results.head(10)
    
    print("=" * 80)
    print("分析涨幅前10名股票的启动形态")
    print("=" * 80)
    
    detailed_results = []
    
    for idx, row in top_stocks.iterrows():
        stock_code = row['stock_code']
        gain = row['december_gain']
        
        print(f"\n【{stock_code}】12月涨幅: {gain:.2f}%")
        
        # 读取数据
        file_path = os.path.join('data', f'{stock_code}.txt')
        if not os.path.exists(file_path):
            print(f"  数据文件不存在")
            continue
        
        df = load_and_clean_data(file_path)
        if df is None:
            print(f"  数据读取失败")
            continue
        
        # 计算启动前的数据
        dec_start = df[df['date'].dt.year == 2025]['date'].min()
        if pd.isna(dec_start):
            print(f"  无2025年数据")
            continue
        
        pre_start = dec_start - pd.Timedelta(days=180)
        df_pre = df[(df['date'] >= pre_start) & (df['date'] < dec_start)].copy()
        
        # 详细分析
        details = analyze_pattern_details(df, stock_code)
        if details:
            print(f"  启动前{details['pre_period_days']}天分析:")
            print(f"    日期范围: {details['pre_start_date']} ~ {details['pre_end_date']}")
            print(f"    价格区间: {details['pre_low']} ~ {details['pre_high']}")
            print(f"    期间涨幅: {details['pre_gain']:.2f}%")
            print(f"    波动幅度: {details['pre_volatility']:.2f}%")
            print(f"    横盘特征: {'是' if details['is_consolidation'] else '否'}")
            print(f"    价格位置: {details['price_position']:.1f}% (0%=最低, 100%=最高)")
            print(f"    量能变化: {details['volume_change']:.2f}倍")
            print(f"    均线趋势: {details['ma_trend']}")
            print(f"    检测形态: {', '.join(details['patterns'])}")
            print(f"    启动时间: {details['launch_date']} (涨幅: {details['launch_gain']:.2f}%, 价格: {details['launch_price']})")
            print(f"  筹码统计:")
            print(f"    筹码集中度: {details['chip_concentration']:.2f}% ({details['chip_status']})")
            print(f"    筹码位置: {details['chip_position']}")
            print(f"    获利比例: {details['profit_ratio']:.2f}%")
            print(f"    平均成本: {details['avg_cost']:.2f}")
            print(f"    成本偏离度: {details['cost_deviation']:.2f}%")
            print(f"    主力成本区: {details['peak_price']:.2f} (筹码量: {details['peak_volume']:.0f})")
            print(f"    阻力区: {details['valley_price']:.2f} (筹码量: {details['valley_volume']:.0f})")
            print(f"    筹码峰数: {details['num_peaks']}")
            print(f"    筹码谷数: {details['num_valleys']}")
            
            # 准备筹码统计信息用于绘图
            chip_stats_for_pattern = {
                'chip_concentration': details['chip_concentration'],
                'chip_position': details['chip_position'],
                'profit_ratio': details['profit_ratio'],
                'avg_cost': details['avg_cost'],
                'peak_price': details['peak_price'],
                'peak_volume': details['peak_volume'],
                'valley_price': details['valley_price'],
                'valley_volume': details['valley_volume'],
                'num_peaks': details['num_peaks'],
                'num_valleys': details['num_valleys']
            }
            
            # 绘制图表
            plot_stock_pattern(df, stock_code, gain, chip_stats_for_pattern)
            
            # 绘制筹码分布图
            if details.get('chip_distribution'):
                chip_stats_for_plot = {
                    'distribution': details['chip_distribution']['distribution'],
                    'concentration': details['chip_distribution']['concentration'],
                    'peaks': details['chip_distribution']['peaks'],
                    'valleys': details['chip_distribution']['valleys'],
                    'profit_ratio': details['profit_ratio']
                }
                plot_chip_distribution(df_pre, stock_code, chip_stats_for_plot)
            
            detailed_results.append(details)
    
    # 保存详细分析结果
    if detailed_results:
        df_detailed = pd.DataFrame(detailed_results)
        df_detailed.to_excel('2025年12月涨幅前10名启动形态详细分析.xlsx', index=False)
        print(f"\n详细分析结果已保存到: 2025年12月涨幅前10名启动形态详细分析.xlsx")
        
        # 统计总结
        print("\n" + "=" * 80)
        print("启动形态总结:")
        print("=" * 80)
        consolidation_count = sum(1 for d in detailed_results if d['is_consolidation'])
        print(f"横盘启动: {consolidation_count}/{len(detailed_results)} ({consolidation_count/len(detailed_results)*100:.1f}%)")
        
        ma_trend_counts = {}
        for d in detailed_results:
            trend = d['ma_trend']
            ma_trend_counts[trend] = ma_trend_counts.get(trend, 0) + 1
        print(f"\n均线趋势分布:")
        for trend, count in ma_trend_counts.items():
            print(f"  {trend}: {count}/{len(detailed_results)} ({count/len(detailed_results)*100:.1f}%)")
        
        # 统计各种形态
        pattern_counts = {}
        for d in detailed_results:
            for pattern in d['patterns']:
                pattern_type = pattern.split('(')[0].strip()
                pattern_counts[pattern_type] = pattern_counts.get(pattern_type, 0) + 1
        
        print(f"\n形态类型分布:")
        for pattern, count in sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {pattern}: {count}/{len(detailed_results)} ({count/len(detailed_results)*100:.1f}%)")
        
        avg_price_position = np.mean([d['price_position'] for d in detailed_results])
        print(f"\n平均价格位置: {avg_price_position:.1f}%")
        
        avg_volume_change = np.mean([d['volume_change'] for d in detailed_results])
        print(f"平均量能变化: {avg_volume_change:.2f}倍")
        
        # 筹码统计总结
        print("\n" + "=" * 80)
        print("筹码统计总结:")
        print("=" * 80)
        
        avg_chip_concentration = np.mean([d['chip_concentration'] for d in detailed_results])
        print(f"平均筹码集中度: {avg_chip_concentration:.2f}%")
        
        chip_status_counts = {}
        for d in detailed_results:
            status = d['chip_status']
            chip_status_counts[status] = chip_status_counts.get(status, 0) + 1
        print(f"\n筹码状态分布:")
        for status, count in chip_status_counts.items():
            print(f"  {status}: {count}/{len(detailed_results)} ({count/len(detailed_results)*100:.1f}%)")
        
        chip_position_counts = {}
        for d in detailed_results:
            position = d['chip_position']
            chip_position_counts[position] = chip_position_counts.get(position, 0) + 1
        print(f"\n筹码位置分布:")
        for position, count in chip_position_counts.items():
            print(f"  {position}: {count}/{len(detailed_results)} ({count/len(detailed_results)*100:.1f}%)")
        
        avg_profit_ratio = np.mean([d['profit_ratio'] for d in detailed_results])
        print(f"\n平均获利比例: {avg_profit_ratio:.2f}%")
        
        avg_cost_deviation = np.mean([d['cost_deviation'] for d in detailed_results])
        print(f"平均成本偏离度: {avg_cost_deviation:.2f}%")
        
        avg_num_peaks = np.mean([d['num_peaks'] for d in detailed_results])
        print(f"平均筹码峰数: {avg_num_peaks:.1f}")
    
    print("\n分析完成！")

if __name__ == '__main__':
    main()
