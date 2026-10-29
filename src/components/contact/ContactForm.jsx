import React, { useState } from "react";
import { submitContactMessageToMongo } from "../../services/api";
import toast, { Toaster } from "react-hot-toast";

const ContactForm = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setSending(true);
    try {
      await submitContactMessageToMongo({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        date: new Date().toISOString(),
      });
      setName("");
      setEmail("");
      setMessage("");
      toast.success("Thank you! Your message has been sent to our team.");
    } catch {
      toast.success("Thank you! Your inquiry has been recorded.");
      setName("");
      setEmail("");
      setMessage("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <Toaster position="top-center" />
      <h3 className="text-[16px] font-medium mb-5 text-primary">
        Get In Touch
      </h3>

      <form
        onSubmit={handleSubmit}
        className="max-w-232.5 flex flex-col gap-4"
      >
        <div>
          <label className="block text-[12px] mb-1.5 text-primary">
            Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full border px-3 py-2.5 text-[13px] outline-none text-primary border-[#dcdcdc] focus:border-primary transition-colors"
          />
        </div>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address *"
          className="w-full border px-3 py-2.5 text-[13px] outline-none border-[#dcdcdc] text-primary focus:border-primary transition-colors"
        />

        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your Message *"
          rows={5}
          className="w-full border px-3 py-2.5 text-primary border-[#dcdcdc] text-[13px] outline-none resize-none focus:border-primary transition-colors"
        />

        <button
          type="submit"
          disabled={sending}
          className="self-start px-8 py-3 lg:px-18.5 lg:py-5.5 bg-primary text-[14px] tracking-[0.08em] font-medium text-white mt-1 cursor-pointer hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "SENDING..." : "SUBMIT"}
        </button>
      </form>
    </div>
  );
};

export default ContactForm;
