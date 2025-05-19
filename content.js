/**
 * content.js
 * Description: Main JavaScript logic for the cube-solve-analytics widget.
 * 
 * Author: Emil
 * License: GPL-3.0-or-later
 * 
 * This file is part of the cube-solve-analytics project.
 * 
 * This script uses third-party libraries licensed under MIT license:
 * - chart.min.js
 * - chartjs-plugin-zoom.min.js
 */

console.log('cstimer analytics extension loaded');

class CubeAnalytics {
  constructor() {
    this.container = null;
    this.chart = null;
    this.isExpanded = false;
    this.isFullscreen = false;
    this.activeTab = 'stats';
    this.init();
  }

  init() {
    this.createContainer();
    this.addEventListeners();
    this.update();
  }

  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'cube-analytics';
    this.container.className = 'collapsed';
    this.container.innerHTML = `
        <div class="toolbar">
            <div class="tabs">
                <button class="tab-btn active" data-tab="stats">Stats</button>
                <button class="tab-btn" data-tab="chart">Chart</button>
                <button class="tab-btn" data-tab="daily">Daily</button>
                <button class="tab-btn" data-tab="calendar">Calendar</button>
                <button class="tab-btn" data-tab="distribution">Distribution</button>
            </div>
            <div class="controls">
                <button class="fullscreen-btn">⛶</button>
                <button class="refresh-btn">⟳</button>
                <button class="toggle-btn">▶</button>
            </div>
            <span class="session-name"></span>
        </div>
        <div class="content">
            <!-- Вкладка со статистикой -->
            <div class="tab-content stats-tab active" data-tab="stats">
                <div class="stats-container"></div>
            </div>
            <!-- Вкладка с графиком -->
            <div class="tab-content chart-tab" data-tab="chart">
                <div class="chart-controls">
                    <button class="reset-zoom-btn">⟲ Reset Zoom</button>
                </div>
                <div class="chart-container">
                    <canvas></canvas>
                </div>
            </div>

            <div class="tab-content daily-tab" data-tab="daily">
                <div class="chart-controls">
                    <button class="reset-zoom-btn-daily">⟲ Reset Zoom</button>
                </div>
                <div class="chart-container">
                    <canvas class="daily-chart"></canvas>
                </div>
            </div>

            <div class="tab-content calendar-tab" data-tab="calendar">
                <div class="calendar-container"></div>
            </div>

            <div class="tab-content distribution-tab" data-tab="distribution">
                <div class="distribution-controls">
                    <input type="number" class="bin-step" value="5" step="1" min="1">
                    <button class="update-bins-btn">Update</button>
                </div>
                <div class="distribution-container">
                    <canvas></canvas>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(this.container);
  }

  async fetchSolves(sessionName) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('cstimer');

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('sessions', 'readonly');
        const store = transaction.objectStore('sessions');
        const solves = [];

        store.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor?.key.startsWith(sessionName)) {
            cursor.value.forEach(solve => {
              const [penaltyMs, solveTimeMs] = solve[0];
              if (penaltyMs !== -1) {
                solves.push({
                  time: (penaltyMs + solveTimeMs) / 1000,
                  index: solves.length + 1,
                  date: new Date(solve[3] * 1000) // Сохраняем дату
                });
              }
            });
          }
          cursor?.continue();
        };

        transaction.oncomplete = () => resolve(solves);
        transaction.onerror = (e) => reject(e.target.error);
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  updateCalendar(solves) {
    const calendarContainer = this.container.querySelector('.calendar-container');
    calendarContainer.innerHTML = '';

    // Группируем по датам
    const dailyCounts = solves.reduce((acc, solve) => {
      const dateStr = this.getLocalDateString(solve.date);
      acc[dateStr] = (acc[dateStr] || 0) + 1;
      return acc;
    }, {});

    // Создаем календарь
    const years = [...new Set(solves.map(s => s.date.getFullYear()))].sort();

    years.forEach(year => {
      const yearDiv = document.createElement('div');
      yearDiv.className = 'calendar-year';

      // Заголовок года
      const yearHeader = document.createElement('h3');
      yearHeader.textContent = year;
      yearDiv.appendChild(yearHeader);

      // Сетка месяцев
      const grid = document.createElement('div');
      grid.className = 'calendar-grid';

      for (let month = 0; month < 12; month++) {
        const monthDiv = document.createElement('div');
        monthDiv.className = 'calendar-month';

        // Заголовок месяца
        const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'short' });
        const monthHeader = document.createElement('div');
        monthHeader.className = 'calendar-month-header';
        monthHeader.textContent = monthName;
        monthDiv.appendChild(monthHeader);

        // Ячейки дней
        const daysDiv = document.createElement('div');
        daysDiv.className = 'calendar-days';

        // 666666
        const firstDayOfMonth = new Date(year, month, 1);
        const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
        for (let i = 0; i < startOffset; i++) {
          daysDiv.appendChild(document.createElement('div')).className = 'calendar-day empty';
        }

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          const dateStr = date.toISOString().split('T')[0];
          const count = dailyCounts[dateStr] || 0;

          const dayCell = document.createElement('div');
          dayCell.className = `calendar-day ${count > 0 ? 'active' : ''}`;
          dayCell.style.backgroundColor = this.getColorForCount(count);
          dayCell.title = `${dateStr}: ${count} solves`;
          daysDiv.appendChild(dayCell);
        }

        monthDiv.appendChild(daysDiv);
        grid.appendChild(monthDiv);
      }

      yearDiv.appendChild(grid);
      calendarContainer.appendChild(yearDiv);
    });
  }

  getColorForCount(count) {
    const maxCount = 130; // подгоним под твои реальные максимумы
    const normalized = Math.log(1 + count) / Math.log(1 + maxCount); // логарифм
    const hue = 120;
    const saturation = 80;
    const lightness = 90 - normalized * 60; // от 90 до 30
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  updateDistribution(solves, step = 5) {
    if (this.distributionChart) this.distributionChart.destroy();
    if (!solves.length) return;

    const times = solves.map(s => s.time);
    const maxTime = Math.ceil(Math.max(...times));
    const bins = Array.from({ length: Math.ceil(maxTime / step) + 1 }, (_, i) => i * step);

    // Группируем данные
    const counts = new Array(bins.length).fill(0);
    times.forEach(time => {
      const binIndex = Math.floor(time / step);
      counts[binIndex] = (counts[binIndex] || 0) + 1;
    });

    const total = solves.length;
    const ctx = this.container.querySelector('.distribution-tab canvas').getContext('2d');

    this.distributionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: bins.map((b, i) => `${b.toFixed(1)} - ${(b + step).toFixed(1)}`),
        datasets: [{
          label: 'Number of Solves',
          data: counts,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const count = context.raw;
                const percent = ((count / total) * 100).toFixed(1);
                return `${count} solves (${percent}%)`;
              }
            }
          },
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time Range (seconds)' },
            ticks: { autoSkip: true, maxRotation: 45 }
          },
          y: {
            title: { display: true, text: 'Number of Solves' },
            beginAtZero: true
          }
        }
      }
    });
  }

  calculateDailyAverages(solves) {
    const dailyData = solves.reduce((acc, solve) => {
      const dateStr = this.getLocalDateString(solve.date);
      if (!acc[dateStr]) {
        acc[dateStr] = {
          times: [],
          count: 0
        };
      }
      acc[dateStr].times.push(solve.time);
      acc[dateStr].count++;
      return acc;
    }, {});

    return Object.entries(dailyData)
      .filter(([_, data]) => data.count >= 5) // Для статистической значимости
      .map(([date, data]) => {
        const sorted = [...data.times].sort((a, b) => a - b);

        // Рассчитываем квантили
        const q1 = this.calculatePercentile(sorted, 0.25);
        const q3 = this.calculatePercentile(sorted, 0.75);
        const iqr = q3 - q1;

        // Границы "коридора" (можно настроить множитель)
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        return {
          date,
          median: this.calculatePercentile(sorted, 0.5),
          q1,
          q3,
          iqr,
          lowerBound: Math.max(lowerBound, sorted[0]), // Не ниже реального минимума
          upperBound: Math.min(upperBound, sorted[sorted.length - 1]), // Не выше реального максимума
          count: data.count
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  calculateAo(times, windowSize) {
    return times.map((_, index) => {
      if (index < windowSize - 1) return null;
      const start = index - windowSize + 1;
      const subset = times.slice(start, index + 1);
      const sorted = [...subset].sort((a, b) => a - b);
      sorted.pop(); // Удаляем худший
      sorted.shift(); // Удаляем лучший
      const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      return Math.floor(avg * 100) / 100; // Use floor instead of round for truncation
    });
  }

  calculateBestAo(times, windowSize) {
    if (times.length < windowSize) return null;
    let best = Infinity;

    for (let i = windowSize - 1; i < times.length; i++) {
      const subset = times.slice(i - windowSize + 1, i + 1);
      const sorted = [...subset].sort((a, b) => a - b);
      const trimmedSubset = sorted.slice(1, sorted.length - 1);
      const current = trimmedSubset.reduce((a, b) => a + b, 0) / trimmedSubset.length;
      const truncated = Math.floor(current * 100) / 100; // Use floor instead of round
      if (truncated < best) best = truncated;
    }

    return best;
  }

  calculateTrendLine(xValues, yValues) {
    const n = xValues.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += xValues[i];
      sumY += yValues[i];
      sumXY += xValues[i] * yValues[i];
      sumXX += xValues[i] * xValues[i];
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return xValues.map(x => slope * x + intercept);
  }

  calculateMo3(times) {
    return times.map((_, index) => {
      if (index < 2) return null;
      const subset = times.slice(index - 2, index + 1);
      const avg = subset.reduce((a, b) => a + b, 0) / 3;
      return Math.floor(avg * 100) / 100; // Use floor instead of round
    });
  }
  
  calculateBestMo3(times) {
    if (times.length < 3) return null;
    let best = Infinity;
    for (let i = 2; i < times.length; i++) {
      const subset = times.slice(i - 2, i + 1);
      const current = subset.reduce((a, b) => a + b, 0) / 3;
      const truncated = Math.floor(current * 100) / 100; // Use floor instead of round
      if (truncated < best) best = truncated;
    }
    return best;
  }

  calculateEMA(times, alpha = 0.1) {
    const ema = [];
    times.forEach((t, i) => {
      if (i === 0) ema.push(t);
      else ema.push(alpha * t + (1 - alpha) * ema[i - 1]);
    });
    return ema;
  }

  updateChart(solves) {
    if (this.chart) this.chart.destroy();

    const times = solves.map(s => s.time);
    const indices = solves.map(s => s.index);
    const ao5 = this.calculateAo(times, 5);
    const ao12 = this.calculateAo(times, 12);

    // Новая функция для расчета линейной регрессии
    const trendLine = this.calculateTrendLine(indices, times);

    const ctx = this.container.querySelector('canvas').getContext('2d');
    const ema10 = this.calculateEMA(times, 0.1);  // EMA с альфой 0.1

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: indices,
        datasets: [
          {
            label: 'Single Solves',
            data: times,
            borderColor: 'rgba(150, 150, 150, 0.3)',
            backgroundColor: 'rgba(150, 150, 150, 0.05)',
            borderWidth: 1,
            pointRadius: 0,
            tension: 0
          },
          {
            label: 'AO5',
            data: ao5,
            borderColor: '#FF4444',
            borderWidth: 2,
            tension: 0.1, // Плавная линия
            pointRadius: 0,
            fill: false
          },
          {
            label: 'AO12',
            data: ao12,
            borderColor: '#00C853',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Linear Regression',
            data: trendLine,
            borderColor: '#6200EA',
            borderWidth: 1, // Увеличим толщину
            tension: 0.3, 
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'EMA (0.1)',
            data: ema10,
            borderColor: '#FFA000',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 15,
              padding: 10,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0,0,0,0.85)',
            bodyFont: { size: 12 },
            titleFont: { size: 12 }
          },
          zoom: {
            zoom: {
              wheel: { enabled: true },
              drag: { enabled: true, modifierKey: 'ctrl' },
              mode: 'x'
            },
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: 'shift'
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Solve Number',
              font: { size: 12 }
            },
            grid: {
              color: 'rgba(0,0,0,0.07)',
              drawTicks: false
            }
          },
          y: {
            title: {
              display: true,
              text: 'Time (seconds)',
              font: { size: 12 }
            },
            grid: {
              color: 'rgba(0,0,0,0.07)',
              drawTicks: false
            },
            beginAtZero: true
          }
        },
        elements: {
          line: {
            tension: 0.1 // Единое значение для всех линий
          }
        }
      }
    });
  }

  updateDailyAverages(solves) {
    if (this.dailyChart) this.dailyChart.destroy();

    const dailyData = this.calculateDailyAverages(solves);
    if (dailyData.length === 0) return;

    const ctx = this.container.querySelector('.daily-chart').getContext('2d');
    const labels = dailyData.map(d => d.date);

    this.dailyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Median (Q2)',
            data: dailyData.map(d => d.median),
            borderColor: '#2196F3',
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.1
          },
          {
            label: 'Q3 + 1.5×IQR',
            data: dailyData.map(d => d.upperBound),
            borderColor: '#FF9800',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.1
          },
          {
            label: 'Q1 - 1.5×IQR',
            data: dailyData.map(d => d.lowerBound),
            borderColor: '#FF9800',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              usePointStyle: true,
              boxWidth: 10
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0,0,0,0.85)',
            bodyFont: { size: 12 },
            titleFont: { size: 12 },
            callbacks: {
              title: (context) => dailyData[context[0].dataIndex].date,
              label: (context) => {
                // Показывать метку только для первого датасета (Median)
                if (context.datasetIndex !== 0) return null;
                const dayData = dailyData[context.dataIndex];
                return [
                  `Median: ${dayData.median.toFixed(2)}s`,
                  `Range: ${dayData.lowerBound.toFixed(2)} - ${dayData.upperBound.toFixed(2)}s`,
                  `Solves: ${dayData.count}`
                ];
              }
            }
          },
          zoom: {
            zoom: {
              wheel: { enabled: true },
              drag: { enabled: true, modifierKey: 'ctrl' },
              mode: 'x'
            },
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: 'shift'
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Date' },
            ticks: {
              autoSkip: true,
              maxRotation: 45,
              callback: (value) => labels[value]
            }
          },
          y: {
            title: { display: true, text: 'Time (seconds)' },
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  truncateToTwoDecimalPlaces(num) {
    return Math.floor(num * 100) / 100;
  }

  calculateStats(times) {
    if (times.length === 0) return {};

    const mean = times.reduce((a, b) => a + b) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    //const std = Math.sqrt(times.reduce((a, t) => a + (t - mean) ** 2, 0) / times.length);

    const n = times.length;
    const variance = times.reduce((a, t) => a + Math.pow(t - mean, 2), 0) / n;
    const std = Math.sqrt(variance);

    // Расчет асимметрии
    const skewness = n > 3
      ? (times.reduce((a, t) => a + Math.pow((t - mean) / std, 3), 0) * n) / ((n - 1) * (n - 2))
      : null;

    // Расчет эксцесса
    const kurtosis = n > 4
      ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) *
      times.reduce((a, t) => a + Math.pow((t - mean) / std, 4), 0) -
      (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3))
      : null;

    return {
      'Solves': times.length,
      'Mean': mean.toFixed(2),
      'Best': sorted[0].toFixed(2),
      'Worst': sorted[sorted.length - 1].toFixed(2),

      // distribution
      'Std Dev': std.toFixed(2),
      'CV': `${((std / mean) * 100).toFixed(2)}%`,
      'Skewness': skewness?.toFixed(2) ?? '-',
      'Kurtosis': kurtosis?.toFixed(2) ?? '-',

      // procentiles
      '25th %ile': this.calculatePercentile(times, 0.25).toFixed(2),
      '50th %ile': this.calculatePercentile(times, 0.5).toFixed(2),
      '75th %ile': this.calculatePercentile(times, 0.75).toFixed(2),
      'IQR': (this.calculatePercentile(times, 0.75) - this.calculatePercentile(times, 0.25)).toFixed(2),

      // Averages section
      'Current ao5': this.calculateAo(times, 5).slice(-1)[0]?.toFixed(2) || '-',
      'Best ao5': this.calculateBestAo(times, 5)?.toFixed(2) || '-',
      'Current ao12': this.calculateAo(times, 12).slice(-1)[0]?.toFixed(2) || '-',
      'Best ao12': this.calculateBestAo(times, 12)?.toFixed(2) || '-',
      'Current ao100': this.calculateAo(times, 100).slice(-1)[0]?.toFixed(2) || '-',
      'Best ao100': this.calculateBestAo(times, 100)?.toFixed(2) || '-',
      'Current mo3': this.calculateMo3(times).slice(-1)[0]?.toFixed(2) || '-',
      'Best mo3': this.calculateBestMo3(times)?.toFixed(2) || '-'
    };
  }

  calculatePercentile(times, p) {
    const sorted = [...times].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const floor = Math.floor(index);
    return sorted[floor] + (sorted[floor + 1] - sorted[floor]) * (index - floor);
  }

  updateStats(solves) {
    const times = solves.map(s => s.time);
    const stats = this.calculateStats(times);

    // Группируем статистики по категориям
    const categories = {
      'General': ['Solves', 'Mean', 'Best', 'Worst', 'Std Dev', 'CV', 'Skewness', 'Kurtosis'],
      'Percentiles': ['25th %ile', '50th %ile', '75th %ile', 'IQR'],
      'Average': [
        'Current ao5', 'Best ao5',
        'Current ao12', 'Best ao12',
        'Current ao100', 'Best ao100',
        'Current mo3', 'Best mo3'
      ]
    };

    const statsHTML = Object.entries(categories)
      .map(([title, keys]) => `
      <div class="stats-group">
        <h4 class="group-title">${title}</h4>
        <div class="group-items">
          ${keys.map(key => `
            <div class="stat-item">
              <span class="stat-key">${key}</span>
              <span class="stat-val">${stats[key]}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    this.container.querySelector('.stats-container').innerHTML = statsHTML;
  }

  toggleView() {
    this.isExpanded = !this.isExpanded;

    // Принудительно сбрасываем полноэкранный режим
    if (this.isFullscreen) {
      this.container.classList.remove('fullscreen');
      this.isFullscreen = false;
    }

    this.container.classList.toggle('expanded', this.isExpanded);
    this.container.classList.toggle('collapsed', !this.isExpanded);

    this.container.querySelector('.tabs').style.display = this.isExpanded ? 'flex' : 'none';
    this.container.querySelector('.fullscreen-btn').style.display = this.isExpanded ? 'block' : 'none';
    this.container.querySelector('.toggle-btn').textContent = this.isExpanded ? '▼' : '▶';

    if (this.isExpanded) {
      this.chart?.resize();
    } else {
      // Возвращаем нормальное позиционирование
      this.container.style.cssText = '';
    }
  }

  toggleFullscreen() {
    if (!this.isExpanded) return;
    this.isFullscreen = !this.isFullscreen;
    this.container.classList.toggle('fullscreen', this.isFullscreen);
    this.chart?.resize();
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    this.container.querySelectorAll('.tab-content').forEach(el => {
      el.classList.remove('active');
    });

    this.container.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');

    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    if (this.activeTab === 'chart') {
      this.chart.resize();
    }
  }

  addEventListeners() {
    this.container.querySelector('.toggle-btn').addEventListener('click', () => this.toggleView());
    this.container.querySelector('.refresh-btn').addEventListener('click', () => this.update());
    this.container.querySelector('.fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
    
    this.container.querySelector('.reset-zoom-btn').addEventListener('click', () => {
      if (this.chart) this.chart.resetZoom();
    });
    this.container.querySelector('.reset-zoom-btn-daily').addEventListener('click', () => {
      if (this.dailyChart) this.dailyChart.resetZoom();
    });

    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    window.addEventListener('resize', () => this.chart?.resize());

    this.container.querySelector('.update-bins-btn').addEventListener('click', () => {
      const stepInput = this.container.querySelector('.bin-step');
      const step = parseFloat(stepInput.value) || 1;
      this.updateDistribution(this.lastSolves, step);
    });

    // Обновляем гистограмму при изменении значения в input
    this.container.querySelector('.bin-step').addEventListener('change', () => {
      const stepInput = this.container.querySelector('.bin-step');
      const step = parseFloat(stepInput.value) || 1;
      this.updateDistribution(this.lastSolves, step);
    });
  }

  async update() {
    const session = this.getCurrentSession();
    if (!session) return;

    try {
      const solves = await this.fetchSolves(session);
      if (solves.length === 0) return;

      this.lastSolves = solves;

      this.container.querySelector('.session-name').textContent = `Session ${session.split('_')[1]}`;
      this.updateChart(solves);
      this.updateStats(solves);
      this.updateCalendar(solves);
      this.updateDistribution(solves);
      this.updateDailyAverages(solves);
    } catch (error) {
      console.error('Error updating analytics:', error);
    }
  }

  getCurrentSession() {
    const sessionSelect = document.querySelector('span.click + select');
    return sessionSelect ? `session_${sessionSelect.value.padStart(2, '0')}` : null;
  }
}

new CubeAnalytics();