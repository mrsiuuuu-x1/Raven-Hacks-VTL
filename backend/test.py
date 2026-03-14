import requests

url = "http://127.0.0.1:8000/analyze"

with open(r"C:\Users\TECH POINT\OneDrive\Pictures\UI Design(sms)\City-idea.jpg", "rb") as f:
    response = requests.post(url, files={"file": f})

print(response.json())