from flask import Flask, request, jsonify
import face_recognition
import numpy as np
import base64
import cv2

app = Flask(__name__)


@app.route('/register', methods=['POST'])
def register():
    data = request.json
    name = data['name']
    image_data = data['image']

    image = decode_image(image_data)
    encodings = face_recognition.face_encodings(image)

    if len(encodings) == 0:
        return jsonify({"error": "No face detected"}), 400

    encoding_list = encodings[0].tolist()

    return jsonify({
        "success": True,
        "name": name,
        "encoding": encoding_list
    })


@app.route('/recognize', methods=['POST'])
def recognize():
    data = request.json
    image_data = data['image']
    known_faces = data['known_faces']

    image = decode_image(image_data)
    encodings = face_recognition.face_encodings(image)

    if len(encodings) == 0:
        return jsonify({"error": "No face detected"}), 400

    unknown_encoding = encodings[0]

    for face in known_faces:
        known_encoding = np.array(face["encoding"])

        match = face_recognition.compare_faces(
            [known_encoding],
            unknown_encoding,
            tolerance=0.5
        )

        if match[0]:
            return jsonify({
                "match": True,
                "name": face["name"]
            })

    return jsonify({"match": False})


def decode_image(image_data):
    image_bytes = base64.b64decode(image_data.split(',')[1])
    np_arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


if __name__ == '__main__':
    app.run(port=5001)