import os
import pandas as pd
import numpy as np
from datetime import datetime
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.font_manager import FontProperties

plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

def load_and_clean_data(file_path):
    """读取并标准化日线CSV数据"""
    try:
        df = pd.read_csv(file_path, encoding='utf-8', skiprows=1, sep='\t', comment='#')
    except UnicodeDecodeError:
        try:
            df = pd.read_csv(file_path, encoding='gbk', skiprows=1, sep='\t', comment='#')
        except UnicodeDecodeError:
            df = pd.read_csv(file_path, encoding='gb18030', skiprows=1, sep='\t', comment='#')
    
    df.columns = df.columns.str.strip()
    
    column_mapping = {
        '日期': 'date',
        '开盘': 'open',
        '最高': 'high',
        '最低': 'low',
        '收盘': 'close',
        '成交量': 'volume',
        '成交额': 'amount'
    }
    
    df = df.rename(columns=column_mapping)
    
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.dropna(subset=['date'])
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

def analyze_stock(df, stock_code):
    """分析单只股票是否符合上升通道+低位+缩量特征"""
    if len(df) < 60:
        return None
    
    df = df.copy()
    df['ma5'] = df['close'].rolling(window=5).mean()
    df['ma10'] = df['close'].rolling(window=10).mean()
    df['ma20'] = df['close'].rolling(window=20).mean()
    df['ma60'] = df['close'].rolling(window=60).mean()
    df['vol_ma5'] = df['volume'].rolling(window=5).mean()
    
    recent_30 = df.tail(30)
    
    is_rising_channel, channel_slope = detect_rising_channel(recent_30)
    
    if not is_rising_channel:
        return None
    
    price_60d_high = df.tail(60)['high'].max()
    price_60d_low = df.tail(60)['low'].min()
    current_price = df.iloc[-1]['close']
    
    if price_60d_high > price_60d_low:
        price_position = (current_price - price_60d_low) / (price_60d_high - price_60d_low) * 100
    else:
        price_position = 50
    
    recent_10_vol = df.tail(10)['volume'].mean()
    prev_10_vol = df.iloc[-20:-10]['volume'].mean()
    
    if prev_10_vol > 0:
        volume_change = recent_10_vol / prev_10_vol
    else:
        volume_change = 1.0
    
    df['date'] = pd.to_datetime(df['date'])
    df_december = df[df['date'].dt.month == 12]
    
    if len(df_december) > 0:
        december_start_price = df_december.iloc[0]['close']
        december_end_price = df_december.iloc[-1]['close']
        december_gain = (december_end_price - december_start_price) / december_start_price * 100
    else:
        december_gain = 0
    
    details = {
        'stock_code': stock_code,
        'current_price': round(current_price, 2),
        'price_position': round(price_position, 2),
        'volume_change': round(volume_change, 2),
        'december_gain': round(december_gain, 2),
        'channel_slope': round(channel_slope, 4),
        'ma5': round(df.iloc[-1]['ma5'], 2),
        'ma10': round(df.iloc[-1]['ma10'], 2),
        'ma20': round(df.iloc[-1]['ma20'], 2),
        'ma60': round(df.iloc[-1]['ma60'], 2),
        'recent_vol': round(recent_10_vol, 0),
        'prev_vol': round(prev_10_vol, 0),
        'latest_date': df.iloc[-1]['date'].strftime('%Y-%m-%d')
    }
    
    return details

def plot_potential_stock(df, stock_code, details):
    """绘制潜在股票的形态图"""
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10), gridspec_kw={'height_ratios': [3, 1]})
    
    df_plot = df.tail(60).copy()
    df_plot['date'] = pd.to_datetime(df_plot['date'])
    df_plot['ma5'] = df_plot['close'].rolling(window=5).mean()
    df_plot['ma10'] = df_plot['close'].rolling(window=10).mean()
    df_plot['ma20'] = df_plot['close'].rolling(window=20).mean()
    df_plot['ma60'] = df_plot['close'].rolling(window=60).mean()
    df_plot['vol_ma5'] = df_plot['volume'].rolling(window=5).mean()
    
    ax1.plot(df_plot['date'], df_plot['close'], label='收盘价', linewidth=2, color='#1f77b4')
    ax1.plot(df_plot['date'], df_plot['ma5'], label='MA5', linewidth=1.5, color='#ff7f0e', alpha=0.8)
    ax1.plot(df_plot['date'], df_plot['ma10'], label='MA10', linewidth=1.5, color='#2ca02c', alpha=0.8)
    ax1.plot(df_plot['date'], df_plot['ma20'], label='MA20', linewidth=1.5, color='#d62728', alpha=0.8)
    ax1.plot(df_plot['date'], df_plot['ma60'], label='MA60', linewidth=1.5, color='#9467bd', alpha=0.8)
    
    ax1.fill_between(df_plot['date'], df_plot['low'], df_plot['high'], alpha=0.3, color='#1f77b4')
    
    ax1.set_title(f'{stock_code} - 上升通道+低位+缩量形态\n'
                  f'价格位置: {details["price_position"]:.1f}% | '
                  f'量能变化: {details["volume_change"]:.2f} | '
                  f'12月涨幅: {details["december_gain"]:.2f}% | '
                  f'通道斜率: {details["channel_slope"]:.4f}', 
                  fontsize=14, fontweight='bold')
    ax1.set_ylabel('价格', fontsize=12)
    ax1.legend(loc='upper left', fontsize=10)
    ax1.grid(True, alpha=0.3)
    
    ax2.bar(df_plot['date'], df_plot['volume'], color='#7f7f7f', alpha=0.6, label='成交量')
    ax2.plot(df_plot['date'], df_plot['vol_ma5'], label='量MA5', linewidth=2, color='#e377c2')
    ax2.set_ylabel('成交量', fontsize=12)
    ax2.set_xlabel('日期', fontsize=12)
    ax2.legend(loc='upper left', fontsize=10)
    ax2.grid(True, alpha=0.3)
    
    ax1.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax2.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45, ha='right')
    plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45, ha='right')
    
    plt.tight_layout()
    
    output_dir = 'potential_stocks_charts'
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f'{stock_code}_形态分析.png')
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    return output_path

def main():
    """主函数：筛选符合上升通道+低位+缩量但未启动主升的股票"""
    data_dir = 'data'
    results = []
    
    if not os.path.exists(data_dir):
        print(f"数据目录 {data_dir} 不存在")
        return
    
    csv_files = [f for f in os.listdir(data_dir) if f.endswith('.txt')]
    
    print(f"开始分析 {len(csv_files)} 只股票...")
    
    for i, file in enumerate(csv_files, 1):
        stock_code = file.replace('.txt', '')
        file_path = os.path.join(data_dir, file)
        
        try:
            df = load_and_clean_data(file_path)
            details = analyze_stock(df, stock_code)
            
            if details:
                results.append(details)
                print(f"[{i}/{len(csv_files)}] {stock_code}: 符合条件 - 价格位置={details['price_position']:.1f}%, "
                      f"量能变化={details['volume_change']:.2f}, 12月涨幅={details['december_gain']:.2f}%")
            else:
                print(f"[{i}/{len(csv_files)}] {stock_code}: 不符合条件")
                
        except Exception as e:
            print(f"[{i}/{len(csv_files)}] {stock_code}: 分析失败 - {str(e)}")
            continue
    
    if not results:
        print("未找到符合条件的股票")
        return
    
    df_results = pd.DataFrame(results)
    
    filtered = df_results[
        (df_results['price_position'] < 30) &
        (df_results['volume_change'] < 0.8) &
        (df_results['december_gain'] < 20)
    ].copy()
    
    if len(filtered) == 0:
        print("未找到符合所有筛选条件的股票")
        print(f"原始符合条件的股票数量: {len(df_results)}")
        return
    
    filtered['综合得分'] = (
        (100 - filtered['price_position']) * 0.4 +
        (1 - filtered['volume_change']) * 100 * 0.3 +
        (20 - filtered['december_gain']) * 0.3
    )
    
    filtered = filtered.sort_values('综合得分', ascending=False).reset_index(drop=True)
    
    print(f"\n筛选完成！找到 {len(filtered)} 只符合条件的股票")
    print(f"筛选条件: 价格位置<30%, 量能变化<0.8, 12月涨幅<20%")
    
    output_file = '上升通道低位缩量潜在主升股票.xlsx'
    filtered.to_excel(output_file, index=False, engine='openpyxl')
    print(f"\n结果已保存到: {output_file}")
    
    print("\n前10名股票详情:")
    print(filtered[['stock_code', 'current_price', 'price_position', 'volume_change', 
                    'december_gain', 'channel_slope', '综合得分']].head(10).to_string(index=False))
    
    print("\n开始生成可视化图表...")
    chart_count = min(20, len(filtered))
    
    for i in range(chart_count):
        stock_code = filtered.iloc[i]['stock_code']
        file_path = os.path.join(data_dir, f'{stock_code}.txt')
        
        try:
            df = load_and_clean_data(file_path)
            chart_path = plot_potential_stock(df, stock_code, filtered.iloc[i].to_dict())
            print(f"[{i+1}/{chart_count}] 已生成图表: {chart_path}")
        except Exception as e:
            print(f"[{i+1}/{chart_count}] {stock_code}: 图表生成失败 - {str(e)}")
    
    print(f"\n完成！共生成 {chart_count} 张形态分析图表，保存在 potential_stocks_charts/ 目录")

if __name__ == '__main__':
    main()
