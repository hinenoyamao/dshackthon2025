document.getElementById("searchButton").addEventListener("click", () => {
  const recipeText = document.getElementById("recipeInput").value.trim();
  if (!recipeText) {
    showError("入力が空です。作りたい料理を入力してください。");
    return;
  }
  searchIngredients(recipeText);
});

async function searchIngredients(recipeText) {
  showLoading(true);
  showError("");
  clearResult();

  try {
    const response = await fetch('/parseRecipe', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ recipe: recipeText })
    });

    if (!response.ok) {
      throw new Error('API呼び出しに失敗しました');
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('予期しないデータ形式が返されました');
    }

    displayResult(data);
  } catch (error) {
    showError(error.message);
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}

function showError(message) {
  document.getElementById("error").innerText = message;
}

function clearResult() {
  document.getElementById("result").innerHTML = "";
}

function displayResult(items) {
  if (items.length === 0) {
    document.getElementById("result").innerHTML = "<p>材料が見つかりませんでした。</p>";
    return;
  }

  let html = "<ul>";
  items.forEach(item => {
    html += `<li>${item.name}: ${item.amount}</li>`;
  });
  html += "</ul>";

  document.getElementById("result").innerHTML = html;
}