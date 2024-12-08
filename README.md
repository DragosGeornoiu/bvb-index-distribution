# BVB Portfolio Tracker

The **BVB Portfolio Tracker** is a web-based tool designed to help me compare the weight distribution of stocks in a portfolio against the weights of companies in the Bucharest Stock Exchange (BVB) index. The app provides investment suggestions based on the portfolio data, and allows for the calculation of the optimal investment distribution to achieve a balanced portfolio.

## Purpose

The main objective of this tool is to:
- Compare the stock weight percentages of companies in your portfolio with those in the BVB index.
- Generate fast investment suggestions to help you align your portfolio with the desired distribution of stocks.

## Features

- **Portfolio Comparison**: The app compares the normalized BVB weight distribution to the weight distribution in your portfolio, highlighting differences and suggesting investments to balance the portfolio.

- **Investment Suggestions**: Based on the differences between the BVB index weights and the portfolio weights, the app generates investment suggestions for underrepresented stocks in your portfolio.

- **New Investment**: You can enable new investment and specify the amount to invest in underrepresented stocks, with a minimum investment per stock.

## Technologies and Libraries Used

- **HTML5**: Used to create the basic structure of the app.
- **CSS3**: For styling and layout, ensuring a clean and responsive design.
- **JavaScript**: For logic, file handling, CSV parsing, and generating the portfolio comparison and investment suggestions.
- **FileReader API**: For reading CSV files uploaded by the user.
- **Vanilla JS**: No third-party libraries or frameworks were used for this project.

## How to Use

1. **Upload CSV Files**:
   - Click on the **"Choose file"** button for the **BVB Companies CSV** and **Portfolio CSV** sections to upload the respective CSV files.
   - The CSV file should follow the format defined below:
     - **BVB CSV File Format**:
       ```
       symbol,weight
       TLV,20.87
       SNP,19.66
       H2O,15.79
       ```
     - **Portfolio CSV File Format**:
       ```
       symbol,weight
       TLV,19.85
       SNP,19.08
       H2O,12.95
       ```

2. **Enter Portfolio Information**:
   - Enter the **Total Portfolio Value** (the total value of your current investments).
   - Enable or disable the **Only consider companies in my portfolio** toggle to filter out companies not present in your portfolio.
   - Enable the **New Investment** toggle to add a new investment to underrepresented stocks. If enabled, you will be prompted to enter the **New Investment Amount** and the **Minimum Investment per Stock**.

3. **Generate Report**:
   - Click the **"Generate Report"** button to compare the portfolio weights with the BVB index weights.
   - The app will display a table with the BVB companies, their respective weights, and the difference between the portfolio and BVB weight distributions.
   - If new investment is enabled, investment suggestions will be displayed.

## How It Works

### Portfolio Comparison

1. The BVB data and portfolio data are uploaded via the file input fields.
2. The app calculates the normalized weight for each stock in the BVB index by adjusting the weights so they sum up to 100%.
3. The app then compares the portfolio weights with the BVB normalized weights and calculates the **difference** in investment value and percentage.
4. The results are displayed in a table with the following columns:
   - **Symbol**: The stock symbol (e.g., AAPL, MSFT).
   - **BVB Weight**: The weight of the company in the BVB index.
   - **Normalized BVB Weight**: The weight of the company in the normalized BVB index.
   - **Portfolio Weight**: The weight of the company in your portfolio.
   - **Difference (Value & Percentage)**: The difference between your portfolio's weight and the BVB index weight, both in monetary value and percentage.

### Investment Suggestions

1. If new investment is enabled, the app calculates which stocks are **underrepresented** in your portfolio compared to the BVB index.
2. It then suggests how much money to allocate to each underrepresented stock based on the **new investment amount** and the **minimum investment per stock**.
3. The suggestions are displayed with the stock symbols and the suggested investment amounts.


## Access

You can access the app at:  
[https://dragosgeornoiu.github.io/bvb-index-distribution/](https://dragosgeornoiu.github.io/bvb-index-distribution/)


## Current Status and Future Enhancements

The app is in a **sufficiently working condition** for its intended use and is fully functional for comparing portfolios with the BVB index, generating investment suggestions, and allowing for new investments.

### Planned Enhancements:
1. **Refactor `getUnderweightedStocks` Method**: The current implementation of the method is lengthy and handles multiple responsibilities. It should be refactored to improve readability and maintainability by breaking it down into smaller, more focused functions.
2. **CSV Input Validation**: There should be validation for the CSV input format to ensure that uploaded files are correctly structured and contain valid data, preventing errors during processing.
3. **Improve Suggestion Generation Logic**: The logic behind generating investment suggestions needs enhancement, as there may be scenarios where it doesn't perform as expected or produces inaccurate results. Further refinement and testing are necessary to ensure that edge cases are properly handled and the logic works reliably.
